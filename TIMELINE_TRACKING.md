# Workflow Execution Timeline Tracking

The AI Agent Workflow Builder provides a highly granular and precise timeline tracking system. Tracking execution time is crucial for AI agent workflows because LLM calls and external API requests are asynchronous and variable in latency.

---

## 1. What Have We Included?

We have implemented a **two-tiered timestamp tracking system** combined with a **real-time frontend visualizer**.

### Database-Level Tracking
1. **Workflow Level (`workflow_runs` table)**:
   - `started_at`: The exact time the workflow engine was triggered.
   - `completed_at`: The exact time the final step finished, or the moment the run failed.
2. **Step Level (`step_runs` table)**:
   - `started_at`: Captured milliseconds before the specific executor (e.g., Groq/OpenRouter LLM API) is invoked.
   - `completed_at`: Captured milliseconds after the executor returns a response.
   - `approved_at`: Specific to the `approval_gate` step — the exact time a human user clicked "Approve".

### Application-Level Features
- **GraphQL Subscriptions**: A live websocket connection that pushes timestamp updates to the frontend immediately as they are committed to PostgreSQL.
- **Visual Timeline Component**: A UI widget that calculates `completed_at - started_at` to display live latency for every individual step.

---

## 2. Why Have We Included It?

Building workflows involving Generative AI introduces unique challenges compared to traditional software:

- **High Variability in Latency**: An LLM might take 2 seconds to classify sentiment, but 45 seconds to generate a complex report. If a 5-step workflow takes 1 minute to run, developers *must* know which specific step took 45 seconds.
- **Human-in-the-Loop Bottlenecks**: Workflows often pause at `approval_gate` steps. We need to distinguish between "system execution time" (compute latency) and "waiting time" (how long a manager took to approve the step).
- **Billing and Profiling**: APIs like OpenRouter and Groq charge by usage. Knowing exact durations helps organizations profile model performance (e.g., "Is Llama-3 running faster than Gemini today?") and optimize their pipelines.

---

## 3. What It Does & The Solution

### The Problem: The "Black Box" Pipeline
Without granular tracking, a user triggers a workflow and stares at a generic loading spinner. If the workflow times out or stalls, they have no idea if the database failed, the webhook hung, or the LLM is just taking a long time.

### The Solution: Real-Time Cascading Timelines
Our solution acts like a CI/CD pipeline viewer (similar to GitHub Actions). 

**What it does:**
1. The serverless engine (`functions/_lib/workflow-engine.ts`) strictly wraps every step execution in timestamps:
   ```typescript
   // 1. Mark step as running and capture started_at
   await mutateHasura(`... _set: { status: running, started_at: "now()" }`);
   
   // 2. Execute the step (LLM call, HTTP request, etc.)
   const result = await executeStep(stepConfig, input);
   
   // 3. Mark step as completed and capture completed_at
   await mutateHasura(`... _set: { status: completed, completed_at: "now()" }`);
   ```

2. Because these updates are made via Hasura GraphQL mutations, Hasura's event/subscription engine instantly broadcasts the new timestamps to the Next.js frontend.

3. The frontend `ExecutionTimeline` component (found in `web/src/app/dashboard/runs/[id]/page.tsx`) computes the durations on the fly and renders them.

**Code Sample: Frontend Timeline Rendering**
```tsx
import { useSubscription } from '@apollo/client';
import { WATCH_STEP_RUNS } from '@/lib/graphql';

export function ExecutionTimeline({ runId }: { runId: string }) {
  const { data } = useSubscription(WATCH_STEP_RUNS, { variables: { workflowRunId: runId } });
  const steps = data?.step_runs || [];

  return (
    <div className="run-timeline">
      {steps.map((step: any) => {
        const start = step.started_at ? new Date(step.started_at) : null;
        const end = step.completed_at ? new Date(step.completed_at) : null;
        
        let durationStr = 'Pending...';
        if (start && end) {
          const ms = end.getTime() - start.getTime();
          durationStr = `${(ms / 1000).toFixed(2)}s`; // Solution: Computes exact duration
        } else if (start) {
          durationStr = 'Running...'; // Solution: Provides real-time feedback
        }

        return (
          <div key={step.id} className={`timeline-item ${step.status}`}>
            <div className="timeline-card">
              <div className="flex justify-between">
                <h3>{step.workflow_step.name}</h3>
                <span className="badge">{step.status}</span>
              </div>
              
              <div className="text-sm text-gray-500 mt-2">
                <div>Started: {start ? start.toLocaleTimeString() : '—'}</div>
                <div>Completed: {end ? end.toLocaleTimeString() : '—'}</div>
                
                {/* Visualizes the exact latency for the user */}
                <div className="font-mono mt-1 text-blue-400">Duration: {durationStr}</div>
                
                {step.approved_at && (
                  <div className="text-amber-500 mt-1">
                    Approved at: {new Date(step.approved_at).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### Business Impact of this Solution
By explicitly tracking `started_at`, `completed_at`, and `approved_at`, organizations can use standard SQL or GraphQL to generate powerful analytics:
- **Alerting**: "Alert me if any `http_request` step takes longer than 5 seconds."
- **Efficiency**: "Calculate the average time a workflow spends waiting at an `approval_gate` vs actually executing compute tasks."

### Querying the Data Directly
With the new `duration_seconds` GENERATED ALWAYS AS STORED column added to the schema, you can run highly efficient aggregation queries right from your GraphQL client without doing inline epoch math:

**Query: Get average LLM call duration across the organization**
```graphql
query GetAvgStepDuration($orgId: uuid!) {
  step_runs_aggregate(where: {
    workflow_step: { step_type: { _eq: "llm_call" } },
    workflow_run: { workflow: { org_id: { _eq: $orgId } } },
    duration_seconds: { _is_null: false }
  }) {
    aggregate {
      avg {
        # Aggregates directly on the GENERATED ALWAYS AS STORED PostgreSQL column
        duration_seconds
      }
    }
  }
}
```

---

## 5. Security & Permission Updates (Layer 2 Fixes)

As requested, the Hasura permission YAML has been corrected. Below are the resulting permission blocks for the three critical tables verifying that generated columns are excluded from explicit arrays and step-level gating is enforced:

### `public_step_runs.yaml` (Generated Column Exclusion)
```yaml
  insert_permissions:
    - role: user
      permission:
        columns:
          - workflow_run_id
          - workflow_step_id
          - status
          - started_at
          - input
          - attempt_count
        check:
          workflow_run:
            organization:
              org_members:
                user_id:
                  _eq: X-Hasura-User-Id
                role:
                  _in:
                    - owner
                    - editor
  update_permissions:
    - role: user
      permission:
        columns:
          - status
          - started_at
          - completed_at
          - output
          - error
          - attempt_count
          - approved_by
          - approved_at
        filter:
          workflow_run:
            organization:
              org_members:
                user_id:
                  _eq: X-Hasura-User-Id
                role:
                  _in:
                    - owner
                    - editor
```

### `public_workflow_runs.yaml` (Editor/Owner Only + Strict Verification)
```yaml
  insert_permissions:
    - role: user
      permission:
        columns:
          - org_id
          - workflow_id
          - status
          - triggered_by
          - trigger_type
          - started_at
          - completed_at
          - error
        check:
          _and:
            - organization:
                org_members:
                  user_id:
                    _eq: X-Hasura-User-Id
            - organization:
                org_members:
                  role:
                    _in:
                      - owner
                      - editor
```
*(Note: Viewers have no insert_permission block, and thus cannot trigger runs).*

### `public_workflow_steps.yaml` (Step-Level Gating)
```yaml
  insert_permissions:
    - role: user
      permission:
        columns:
          - workflow_id
          - step_order
          - step_type
          - name
          - config
        check:
          _or:
            - _and:
                - workflow:
                    organization:
                      org_members:
                        user_id:
                          _eq: X-Hasura-User-Id
                        role:
                          _eq: editor
                - step_type:
                    _nin:
                      - db_write
                      - notify
            - workflow:
                organization:
                  org_members:
                    user_id:
                      _eq: X-Hasura-User-Id
                    role:
                      _eq: owner
```
