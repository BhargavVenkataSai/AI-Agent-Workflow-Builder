# AI Agent Workflow Builder

An open-source mini n8n/Zapier-style platform for chaining AI agent steps into automated workflows. Built with **Next.js**, **nhost** (PostgreSQL, Hasura GraphQL, Auth, Serverless Functions), and **Groq LLM API**. Features multi-tenancy with multi-organization support and role-based permissions enforced across database and application layers.

---

## Tech Stack

- **Frontend**: Next.js (App Router), React, Apollo Client (GraphQL subscriptions & queries)
- **Backend**: nhost (Hasura GraphQL Engine, PostgreSQL 14, nhost Auth, Serverless Functions)
- **LLM Engine**: Groq API or OpenRouter API
- **Deployment**: Vercel (Frontend) + nhost Cloud (Backend)

---

## Prerequisites

- **Node.js** v20+
- **Docker** installed & running (required for local nhost)
- **nhost CLI**: `npm install -g nhost`
- **API Key**: Groq API Key or OpenRouter API Key

---

## Quick Start (Local Development)

### 1. Clone & Install
```bash
git clone <repository-url>
cd <project-root>
```

### 2. Set Up nhost
```bash
npm install -g nhost    # if not already installed
nhost up                # starts Postgres, Hasura, Auth, Functions
```

### 3. Configure Environment
Add your API key to `nhost/.secrets`:
```ini
GROQ_API_KEY=your-groq-key-here
# OR
OPENROUTER_API_KEY=your-openrouter-key-here
```

Frontend env is pre-configured in `web/.env.local`.

### 4. Install & Run Frontend
```bash
cd web
npm install
npm run dev
```

### 5. Open http://localhost:3000

### 6. Register Test Users
Create accounts through the signup UI:

| Email | Password | Org | Role |
|---|---|---|---|
| `owner_a@test.com` | `Test1234!` | Acme AI Labs | owner |
| `editor_a@test.com` | `Test1234!` | Acme AI Labs | editor |
| `viewer_a@test.com` | `Test1234!` | Acme AI Labs | viewer |
| `owner_b@test.com` | `Test1234!` | Beta Corp | owner |

### 7. Apply Seed Data
In the Hasura Console SQL tab (http://localhost:9695), run the contents of `nhost/seeds/default/001_demo_data.sql`.

---

## Project Structure

```
├── nhost/                  # nhost backend configuration
│   ├── nhost.toml         # Main config
│   ├── .secrets           # Local secrets (gitignored)
│   ├── migrations/        # PostgreSQL schema migrations
│   ├── metadata/          # Hasura metadata (tables, permissions, actions, triggers)
│   └── seeds/             # Demo seed data
├── functions/              # nhost Serverless Functions
│   ├── trigger-workflow-run.ts       # Action: start workflow
│   ├── approve-step.ts               # Action: approve paused step
│   ├── webhook-trigger.ts            # Webhook endpoint
│   ├── handle-notify.ts              # Event Trigger: notifications
│   ├── handle-db-event-trigger.ts    # Event Trigger: DB changes
│   ├── handle-scheduled-trigger.ts   # Cron trigger handler
│   └── _lib/
│       ├── hasura-client.ts          # Admin GraphQL client
│       ├── step-executors.ts         # Step execution logic
│       └── workflow-engine.ts        # Core workflow engine
├── web/                    # Next.js Frontend
│   ├── src/app/           # App Router pages
│   ├── src/components/    # React components
│   └── src/lib/           # GraphQL queries & utilities
├── README.md
└── WRITEUP.md
```

---

## Step Types

| Type | Description | Restriction |
|---|---|---|
| `llm_call` | Calls Groq LLM API with retry | — |
| `http_request` | Generic HTTP call with retry | — |
| `db_write` | Saves data to database | Owner only |
| `notify` | Sends notification via Event Trigger | Owner only |
| `conditional_branch` | If/else based on previous output | — |
| `approval_gate` | Pauses run for human approval | — |

## Trigger Types

| Type | Description | Restriction |
|---|---|---|
| Manual | UI "Run" button | Owner/Editor |
| Webhook | External HTTP endpoint | Owner only to create |
| Scheduled | Cron-based | — |
| Database Event | Row change in watched_records | — |

---

## Permission Layers

**Layer 1: Hasura Row-Level Permissions** — Every table's permissions traverse relationships back to `org_members`, scoping all data to the caller's own org. Cross-org access is impossible.

**Layer 2: Action Handler Code** — Sensitive operations (adding db_write/notify steps, webhook triggers, approving steps, triggering runs) are enforced in serverless function code, not just database permissions.

---

## API Keys

- **Groq API**: Required for `llm_call` steps. Get free key at https://console.groq.com
- If no key is configured, `llm_call` steps return a descriptive error without crashing
