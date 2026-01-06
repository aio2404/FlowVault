# FlowVault Privacy Policy (draft)

Last updated: {{DATE}}

> This document captures the privacy posture for the FlowVault/n8nBack SaaS MVP. Share it publicly (website, signup flow) and update it as the data model evolves.

## 1. Who we are

FlowVault (“we”, “our”, “us”) provides workflow versioning services for n8n instances. We act as the **data processor** for workflow/json data imported from your n8n environments. You (the customer organization) remain the **data controller** for all personal data stored inside workflows.

Contact: privacy@flowvault.dev  
Postal address: (fill in once incorporated).

## 2. Data we process

| Data category | Purpose | Retention |
|---------------|---------|-----------|
| Account data (email, name) | Authentication, organization membership | Until deletion request or 90 days after account closure |
| Organization settings (webhooks, SSO metadata) | Deliver alerts, enforce access control | Until updated/removed |
| Workflow metadata + versions | Provide diff/snapshot/rollback features | Configurable by org, default 180 days |
| Execution logs & errors | Monitoring, incident response | 30 days |
| Billing/usage metrics | Invoicing and enforcement of plan limits | 7 years (accounting requirement) |

We **do not** ingest passwords. API keys and secrets synced from n8n are encrypted at rest using AES‑256‑GCM and only decrypted in memory during workflow sync.

## 3. Legal basis (GDPR art. 6)

- Contract performance (art. 6(1)(b)) for providing the service.
- Legitimate interest (art. 6(1)(f)) for security monitoring and product analytics.
- Consent (art. 6(1)(a)) for marketing communications.

## 4. Sub‑processors

| Provider | Role | Region |
|----------|------|--------|
| Amazon Web Services | Hosting (ECS, RDS, S3, Secrets Manager) | EU (Paris / eu‑west‑3) |
| Stripe (optional) | Billing | EU/US (with SCCs) |
| Resend | Transactional email | EU/US (configure EU data region) |

All sub‑processors are bound by data processing agreements and Standard Contractual Clauses where applicable.

## 5. Data subject rights

Customers can exercise the following by emailing privacy@flowvault.dev or via in‑app controls:

- Access / export (Art. 15) – Provide JSON/CSV export of account + workflow metadata.
- Rectification (Art. 16) – Update profile info or edit workflows directly.
- Erasure (Art. 17) – Delete account/organization (includes snapshots, executions, alerts).
- Restriction / objection (Art. 18/21) – Pause processing of a workflow or disable analytics.
- Portability (Art. 20) – Export workflows as JSON for migration.

Requests are logged (audit trail) and fulfilled within 30 days.

## 6. International transfers

Data is hosted in the European Union (eu‑west‑3). If data leaves the EU (e.g., Stripe, Resend), we rely on SCCs/UK IDTA and ensure equivalent protections.

## 7. Security

- Encryption in transit (TLS 1.2+) and at rest (RDS encrypted, Secrets Manager).
- Role‑based access (owner/member) with audit logs.
- SSO (SAML/JWT) available for enterprise plans.
- Regular dependency scanning (Dependabot/pnpm audit) and infrastructure-as-code reviews.
- Backups retained for 30 days; documented disaster recovery plan (docs/runbooks/backups-and-dr.md).

## 8. Cookies & analytics

We currently do not use tracking cookies. Usage metrics are derived from backend logs (pseudo-anonymized).

## 9. Children’s privacy

The service is not intended for users under 16. Accounts created by minors will be removed upon notice.

## 10. Changes

Policy updates are announced via email and changelog. Continued use of the service constitutes acceptance.

---

**Action items before go-live**

- Replace placeholders ({{DATE}}, legal address, contact info).
- Add links from marketing site/app footer.
- Align retention periods with actual backup policies once finalized.
