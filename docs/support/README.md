# Support & Customer Success

> Draft reference for FlowVault support processes. Keep in sync with status page/on-call schedule before launch.

## Contact Channels

| Channel | Use Case | Availability |
|---------|----------|--------------|
| Email – support@flowvault.dev | General questions, bug reports | 24/5, responses within SLA |
| In-app help beacon | Contextual help, quick tips | Business hours |
| Status page – status.flowvault.dev | Incident updates, maintenance windows | 24/7 |
| Slack Connect (Pro+) | Priority questions, co-debugging | Business hours |

## Service Levels

| Plan | First response | Update cadence | Escalation |
|------|----------------|----------------|------------|
| Free | 2 business days | As available | None (community) |
| Pro | 1 business day | Daily until resolved | Escalate to engineer after 24h |
| Team | 4 business hours | Every 6 hours for Sev1, daily otherwise | Immediate engineering + on-call manager |

Severity definitions:
- **Sev1:** Complete service outage or security incident affecting production workflows.
- **Sev2:** Major feature degraded, but workarounds exist.
- **Sev3:** Minor bug, UX issue, feature request.

## Escalation

1. Support engineer triages ticket in Linear (`FLOW-SUP` project).
2. Tag severity + plan; assign to on-call.
3. Escalate via `#flowvault-oncall` Slack if no response in SLA window.
4. Notify customer via status page component and email template (see `docs/runbooks/backups-and-dr.md` for tone).

## Knowledge Base / FAQ

Keep the following articles published on the marketing site or help center:

- Connecting your first n8n instance
- Understanding workflow history and diffs
- Billing limits & upgrade paths
- Incident response & rollback playbook
- Security & privacy overview (link to policies)

## Embedded Support Widget

- Use Crisp/Intercom placeholder key: `NEXT_PUBLIC_SUPPORT_WIDGET_ID`.
- Widget defaults to documentation search; escalate to live chat for Team plan users.
- Warm handoff flow:
  1. Gather logs + workflow ID.
  2. Offer Zoom/Meet link if unresolved within 30 min.

## Marketing & Success Handoff

Every converted lead should have:
- Intro email with onboarding checklist.
- Invite to private community channel.
- Quarterly business review template stored in `/docs/support/qbr-template.md` (TODO).

## Metrics to Track

- Time to first response (TTFR)
- Time to resolution (TTR)
- CSAT (link survey post-ticket)
- Upgrade/downgrade reasons captured in `/billing/change-plan` metadata (future)

Document real tooling + SLAs before GA. For now this acts as internal playbook.
