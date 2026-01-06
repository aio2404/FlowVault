# n8nback

**Automatic versioning, diff, and one-click rollback for n8n workflows.**

n8nback is a SaaS MVP that provides Git-like version control for n8n workflows without requiring Git. It silently snapshots workflow JSON over time, shows visual diffs, and allows instant rollback.

## Features

- **Automatic Versioning**: Silent snapshots of your workflows at configurable intervals
- **Visual Diff**: See exactly what changed between any two versions with node-level summaries
- **One-Click Rollback**: Instantly restore any previous version of your workflow
- **Multi-tenant**: Organizations with owner/member roles
- **Secure**: All API keys encrypted at rest with AES-256-GCM
- **Slack Alerts**: Get notified when workflows change or rollbacks fail
- **Billing insights**: Detailed usage dashboard with per-instance consumption, monthly spend history, and CSV export

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Fastify, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Background Jobs**: BullMQ + Redis
- **Auth**: Custom magic link authentication

## Project Structure

```
n8nback/
├── apps/
│   ├── api/          # Fastify API server
│   ├── web/          # Next.js frontend
│   └── mock-n8n/     # Mock n8n service for local dev
├── packages/
│   └── shared/       # Shared types and schemas
├── infra/
│   ├── docker-compose.yml
│   └── Dockerfile.*
└── docs/
    ├── README.md
    ├── policies/
    │   ├── privacy-policy.md
    │   └── security-baseline.md
    └── runbooks/
        └── backups-and-dr.md
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose (for local services)

### Setup

1. **Clone and install dependencies:**

```bash
git clone <repo-url> n8nback
cd n8nback
pnpm install
```

2. **Set up environment variables:**

```bash
# Copy example env files
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

3. **Start infrastructure services:**

```bash
cd infra
docker compose up -d postgres redis mock-n8n
```

4. **Set up the database:**

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Seed demo data
pnpm db:seed
```

5. **Start the development servers:**

```bash
pnpm dev
```

This starts:
- Web app: http://localhost:3000
- API server: http://localhost:3001
- Mock n8n: http://localhost:5678

### Using Docker Compose (Full Stack)

To run everything in Docker:

```bash
cd infra
docker compose up --build
```

## Environment Variables

### API Server

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | - |
| `APP_ENCRYPTION_KEY` | 32-byte base64 encryption key | - |
| `PORT` | API server port | 3001 |
| `WEB_URL` | Frontend URL (for CORS) | http://localhost:3000 |
| `POLL_INTERVAL_MS` | Background polling interval | 300000 (5 min) |

### Web App

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | API server URL | http://localhost:3001 |

### Generating an Encryption Key

```bash
openssl rand -base64 32
```

## Security & Compliance

- [Privacy Policy (draft)](./policies/privacy-policy.md) – outlines data categories, retention, and sub-processors (GDPR-ready text to publish on the marketing site).
- [Terms of Service (draft)](./policies/terms-of-service.md) – contractual terms governing customer access and use of FlowVault.
- [Legal Notice / Mentions légales](./policies/legal-notice.md) – mandatory EU disclosure with company, hosting, and contact details.
- [Data Processing Agreement template](./policies/dpa-template.md) – controller/processor addendum for GDPR customers.
- [Security Baseline](./policies/security-baseline.md) – lists infrastructure, secrets management, monitoring, and open compliance tasks before GA.
- [Backup & DR Runbook](./runbooks/backups-and-dr.md) – operational procedure for automated snapshots, restores, and quarterly DR drills.
- [Support & Customer Success](./support/README.md) – SLAs, escalation ladder, and channel overview for helping customers.
- [Marketing Automation Workflows](./marketing/README.md) – templates for promo tweets, email digests, and lead capture automations.
- [Product Quality & QA](./quality/README.md) – testing pyramid, accessibility checklist, and release gates.
- [Platform & Infrastructure](./platform/README.md) – AWS architecture, environment matrix, cost guardrails, and deployment flow.

Keep these documents up to date as the product evolves; link them from the marketing site / onboarding emails for enterprise customers.

## API Endpoints

### Authentication

- `POST /auth/magic-link` - Request magic link
- `POST /auth/verify` - Verify magic link token
- `GET /auth/me` - Get current user
- `POST /auth/logout` - Logout

### Organizations

- `POST /organizations` - Create organization
- `GET /organizations/:id` - Get organization
- `PATCH /organizations/:id` - Update organization
- `GET /organizations/:id/members` - List members
- `POST /organizations/:id/members` - Invite member

### n8n Instances

- `GET /instances` - List instances
- `POST /instances` - Add instance
- `GET /instances/:id` - Get instance
- `PATCH /instances/:id` - Update instance
- `DELETE /instances/:id` - Delete instance
- `POST /instances/:id/test` - Test connection
- `POST /instances/:id/import` - Import workflows

### Workflows

- `GET /workflows` - List workflows
- `GET /workflows/:id` - Get workflow
- `GET /workflows/:id/versions` - List versions
- `GET /workflows/:id/versions/:versionId` - Get version
- `GET /workflows/:id/diff?from=&to=` - Get diff
- `POST /workflows/:id/snapshot` - Create snapshot
- `POST /workflows/:id/rollback` - Rollback to version

### Settings

- `GET /settings` - Get organization settings
- `PATCH /settings` - Update settings
- `POST /settings/test-slack` - Test Slack webhook
- `GET /audit-logs` - Get audit logs
- `GET /errors` - Fetch latest workflow execution errors
- `POST /sync-all-executions` - Trigger background pull of executions from all instances
- `GET /incident-timeline` - Unified timeline (errors, deployments, audit events)
- `GET /monitoring/sla` - Aggregated SLA metrics and breaches per workflow/instance

### Billing

- `GET /billing/plan` - Retrieve current plan, limits, and upgrade options
- `GET /billing/usage` - Detailed usage snapshot with cost history
- `GET /billing/usage.csv` - CSV export for chargebacks/finance
- `POST /billing/change-plan` - Upgrade/downgrade plan tier

## Demo Mode

After running `pnpm db:seed`, you can use:

- **Email**: demo@n8nback.dev
- **Organization**: Demo Organization
- **Mock n8n**: Pre-configured at http://localhost:5678

The seed script outputs a demo session token you can use directly.

## Development

### Database Commands

```bash
# Generate Prisma client
pnpm db:generate

# Push schema changes (dev)
pnpm db:push

# Create migration
pnpm db:migrate

# Run Prisma Studio
pnpm db:studio

# Seed database
pnpm db:seed
```

### Testing with Mock n8n

The mock n8n service provides:

- 3 sample workflows
- Basic API endpoints (list, get, update)
- Simulated changes endpoint for testing versioning

To simulate a workflow change:

```bash
curl -X POST http://localhost:5678/api/v1/simulate-change/wf-1 \
  -H "X-N8N-API-KEY: any-key"
```

## Architecture

### Data Flow

1. User connects n8n instance with API key (encrypted at rest)
2. "Import workflows" fetches all workflows and creates initial snapshots
3. Background worker polls instances every N minutes
4. For each workflow, compute SHA-256 hash of JSON
5. If hash differs from latest version, create new WorkflowVersion
6. User views diff and can rollback via n8n API

### Tenant Isolation

All database queries include `organizationId` via middleware. Users can only access data from organizations they're members of.

### Security

- API keys encrypted with AES-256-GCM
- Session tokens are random 32-byte hex strings
- Basic rate limiting on API endpoints
- URL validation for n8n base URLs

## What's Stubbed vs Complete

### Complete
- ✅ Auth with magic link
- ✅ Organizations with owner/member roles
- ✅ n8n instance CRUD with encryption
- ✅ Connection testing
- ✅ Workflow import
- ✅ Version storage with hashing
- ✅ Diff viewer with node-level summary
- ✅ Rollback functionality
- ✅ Audit logging
- ✅ Slack webhook alerts
- ✅ Background polling worker

### Stubbed/Minimal
- ⚠️ Email sending (logs to console in dev)
- ⚠️ Organization deletion (disabled)
- ⚠️ Production deployments
- ⚠️ Tests

## License

MIT
