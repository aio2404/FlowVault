# Manual Test Plan (Draft)

Use this script for pre-release validation. The demo org seeded via `pnpm db:seed` contains all required fixtures (instances, workflows, billing data, marketing automation).

## Accounts

- **User:** demo@n8nback.dev (magic link)  
- **Session token:** printed at the end of `pnpm db:seed` (use `Authorization: Bearer <token>` for API tests).
- **Organization:** Demo Organization (`demo-org-id`)

## Happy Path (approx. 20 min)

1. Login via magic link, land on dashboard.
2. Visit `/app/instances`, confirm “Local Mock n8n” displays workflow count + status badges.
3. Trigger “Import workflows” and ensure marketing workflow `Marketing Promo Scheduler` appears.
4. Go to `/app/workflows`, open marketing workflow, inspect diff + rollback action (no need to confirm).
5. Open `/app/billing`, verify usage bars + cost history.
6. Download CSV export (ensure file has both Instance + Workflow rows).
7. Navigate to `/app/support` via sidebar and open marketing toolkit links (should open new tab).
8. Test support modal from header – open/close with Esc, check focus trap.

## Edge Cases

- Attempt to add a second instance while on Free plan (should block).
- Try `POST /billing/change-plan` to downgrade when usage exceeds target.
- Simulate workflow errors by calling mock service (see `docs/README.md` “Testing with Mock n8n”) then refresh Monitoring page.

## Accessibility Exercises

- Keyboard navigation from sidebar → billing cards → support modal; ensure focus is visible.
- Screen reader labels:
  - Theme toggle button (“Light mode”/“Dark mode” text).
  - Support button (“Support”).
  - CTA links in marketing section (“Get templates”, etc.).

## Regression Smoke API Tests

Use REST client or curl with session token:

```bash
# Instances list
curl -H "Authorization: Bearer <token>" -H "X-Organization-Id: demo-org-id" http://localhost:3001/instances

# Billing usage
curl -H "Authorization: Bearer <token>" -H "X-Organization-Id: demo-org-id" http://localhost:3001/billing/usage

# Billing CSV
curl -o usage.csv -H "Authorization: Bearer <token>" -H "X-Organization-Id: demo-org-id" http://localhost:3001/billing/usage.csv
```

Document pass/fail for each section in Linear ticket `FLOW-QA-<release>`.
