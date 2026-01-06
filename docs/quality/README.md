# Product Quality & QA Strategy

> Draft guidance for FlowVault to reach GA-grade quality. Update once actual CI + test automation are live.

## Goals

- Ship reliable workflow tracking with minimal regressions.
- Provide clear manual QA steps before each release.
- Track accessibility, performance, and localization checks.

## Testing Pyramid

| Layer | Scope | Tooling |
|-------|-------|---------|
| Unit | Pure functions, plan logic (`apps/api/src/lib/plans.ts`, `packages/shared`) | vitest / tsx test runner |
| Integration | Fastify routes w/ Prisma + mocked deps | `pnpm --filter @n8nback/api test` (add soon) |
| E2E | Web + API happy paths (login, connect instance, view diff) | Playwright (headless) |

## Manual QA Checklist (Pre-release)

1. **Authentication**
   - Magic link request/verify flows.
   - Session timeouts & logout.
2. **Instances**
   - Connect mock n8n, test webhook enable/disable.
   - Enforce plan limits for Free tier.
3. **Workflows**
   - Import, diff, rollback, restore targeted nodes.
4. **Monitoring**
   - Errors feed, filtering, incident timeline (if enabled).
5. **Billing**
   - Usage page, CSV export, plan change edge cases.
6. **Support + Marketing**
   - Support modal opens, marketing links reachable.

Record findings in Linear project `FLOW-QA`.

## Accessibility Checklist

- All interactive controls reachable via keyboard-only navigation (Sidebar, Billing CTA, Support widget).
- Use semantic headings (`<h1>`–`<h3>`) on `/app/support`, `/app/billing`, landing page.
- Provide descriptive labels for icons (aria-label on theme toggle, support button).
- Ensure contrast ratios meet WCAG AA (Tailwind tokens already tuned, verify w/ tooling).

## Performance Baseline

- Next.js Lighthouse targets: PWA 80+, Performance 85+, Best Practices 90+, Accessibility 95+.
- API endpoints should respond <300ms p95 for orgs with <=100 workflows (measure via k6 / autocannon).

## QA Tooling TODO

- [ ] Add Vitest config in `packages/shared` + `apps/api`.
- [ ] Add Playwright suite hitting `/auth/login` → connect instance → view monitoring.
- [ ] Wire GitHub Actions workflow running lint, unit tests, and build.
- [ ] Snapshot-based diff tests for workflow comparison UI.

## Release Gate

Before promoting to staging/production:

1. Run `pnpm lint && pnpm typecheck` across all workspaces.
2. Execute automated test suites.
3. Run manual QA checklist above (at least Free + Pro plan user).
4. Verify legal/support links exist in build output.
5. Update CHANGELOG with user-facing changes.

See [Manual Test Plan](./manual-test-plan.md) for detailed pre-release steps tied to the seeded demo org.

Document real CI scripts and sign-off steps once available.
