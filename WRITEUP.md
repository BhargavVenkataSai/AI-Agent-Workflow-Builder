# Technical Writeup: AI Agent Workflow Builder

## Schema Design

The database is structured around a strict multi-tenant hierarchy:

```
organizations
   ├── org_members (user_id, role: owner | editor | viewer)
   └── workflows
        ├── workflow_triggers (manual, webhook, scheduled, database_event)
        ├── workflow_steps (ordered, typed, JSONB config)
        └── workflow_runs (status: pending | running | paused | completed | failed)
             └── step_runs (status, input, output, error, attempt_count, approved_by)
```

### Key Decisions

- **JSONB for step/trigger configuration**: Each step type has different configuration needs (prompt templates for `llm_call`, URL/method for `http_request`, conditions for `conditional_branch`). JSONB allows adding new step types without schema migrations while maintaining queryable, structured data.

- **PostgreSQL enums**: `step_type_enum`, `trigger_type_enum`, `run_status_enum`, `step_run_status_enum`, and `org_role_enum` enforce valid values at the database level, preventing invalid states from ever being persisted.

- **Aggregation view (`v_org_usage_stats`)**: A Postgres view joins `organizations → workflows → workflow_runs` to compute org-level metrics: total runs this period, average run duration, and remaining quota. This avoids expensive runtime aggregation.

- **Unique constraints**: `org_members(org_id, user_id)` prevents duplicate memberships; `workflow_steps(workflow_id, step_order)` ensures unique step ordering within a workflow.

---

## Two Permission Layers

### Layer 1 — Hasura Row-Level Permissions (Org + Role Scoping)

Every table's Hasura permissions traverse relationships back to `org_members` to scope data to the caller's organization. This is configured in Hasura metadata, not application code.

**Example**: To view `step_runs`, the permission filter is:
```
step_runs → workflow_run → workflow → organization → org_members
  WHERE user_id = X-Hasura-User-Id
```

This means **even if a user guesses a step_run UUID belonging to another org, Hasura returns nothing** — the filter is applied at the SQL query compilation level before data ever reaches the application.

**Role scoping within Layer 1:**
- **Owner**: Full CRUD on all org resources (workflows, steps, triggers, members)
- **Editor**: Can create/edit workflows and steps, trigger runs; cannot manage members
- **Viewer**: Read-only across everything; cannot trigger runs

### Layer 2 — Action Handler Code (Step-Level Gating)

Some rules cannot be expressed as row-level permissions because they involve **mid-execution decisions** or **type-specific restrictions**:

1. **Sensitive step creation**: Only `owner` can add `db_write` or `notify` steps, or create `webhook` triggers. Enforced in both the frontend (UI disables buttons) and backend (Action handler rejects).

2. **`triggerWorkflowRun` Action**: The serverless function queries `org_members` to verify the caller is `owner` or `editor`, then checks quota before creating the run. A `viewer` is rejected with 403.

3. **`approveStep` Action** (most critical): When a user attempts to approve a paused `approval_gate` step, the handler traverses:
   ```
   step_run → workflow_run → workflow → organization → org_members
   ```
   and verifies the approver holds `owner` or `editor` role. This **cannot be a database permission** because it's a mid-execution decision that resumes an async workflow — not a simple row read/write.

---

## Approval Gate: Pause/Resume Implementation

The `approval_gate` step type creates a human-in-the-loop checkpoint in the workflow pipeline.

### How Pause Works

1. The workflow engine processes steps sequentially. When it encounters an `approval_gate`:
   - Sets `step_run.status = 'awaiting_approval'`
   - Sets `workflow_run.status = 'paused'`
   - **Stops execution** (returns from the async function)

2. The GraphQL subscription on `step_runs` immediately fires, and the frontend displays the "awaiting approval" state with an amber badge and an "Approve" button.

### How Resume Works

3. An authorized user clicks "Approve". The frontend calls the `approveStep` Hasura Action.

4. The Action handler:
   - Validates the approver's org membership and role (**Layer 2 check**)
   - Updates `step_run`: `status = 'approved'`, `approved_by = user_id`, `approved_at = now()`
   - Updates `workflow_run`: `status = 'running'`
   - Calls `executeWorkflow(workflowRunId, nextStepOrder)` as **fire-and-forget** (non-blocking)
   - Returns immediately to the GraphQL client

5. The workflow engine resumes from `nextStepOrder`, executing remaining steps and updating `step_runs` via the admin client — each update triggers the subscription, streaming live progress to the UI.

### Why Fire-and-Forget

The `executeWorkflow()` call after approval is intentionally not awaited. This lets the Action return a fast response while the engine runs asynchronously. Step status updates flow through the subscription in real-time.

---

## Retry & Quota Enforcement

- **Step retries**: `llm_call` and `http_request` steps automatically retry once on failure (HTTP errors, timeouts, rate limits) before marking the step as `failed`.

- **Quota checking**: `triggerWorkflowRun` checks `organizations.quota_used < organizations.quota_limit` before allowing execution. On successful run completion, `quota_used` is incremented.

- **Monthly reset**: A PostgreSQL function `reset_org_quotas()` resets counters when the period rolls over, callable via cron trigger.
