# Security & Compliance Baseline

This document lists the controls and operational practices required before onboarding paying customers. Treat it as a living runbook and link it in onboarding/ISO questionnaires.

## 1. Governance

- **Ownership**: CTO (security@flowvault.dev) maintains the program; DPO handles GDPR requests (privacy@flowvault.dev).
- **Policies**: Privacy Policy (docs/policies/privacy-policy.md), Backup & DR (docs/runbooks/backups-and-dr.md), Incident Response (TODO), Password/Access policy (TODO).
- **Audits**: Quarterly review of access logs, dependency updates, and infrastructure security groups.

## 2. Infrastructure

| Area | Control |
|------|---------|
| Cloud provider | AWS EU (Paris). Resources defined via Terraform (`infra/terraform`). |
| Networking | Dedicated VPC, private subnets for ECS/RDS, ALB in public subnets, SG principle of least privilege. |
| Secrets | AWS Secrets Manager + Parameter Store. No secrets committed to git. Per-service IAM roles with minimal policies. |
| Compute | ECS Fargate tasks run as non-root containers, read-only root FS (set in task defs). Runtime env locked to Node 20 (ASLR/DEP). |
| Database | RDS PostgreSQL encryption at rest, automated backups (7 days), manual snapshots via Ansible runbook. |
| Backups | Daily RDS snapshot + hourly WAL, S3 bucket with versioning for exported snapshots. Test restore monthly. |
| Disaster recovery | Documented in docs/runbooks/backups-and-dr.md; RTO < 4h, RPO < 1h for prod. |

## 3. Application security

- **Authentication**: Magic-link + optional SSO (SAML/JWT). Sessions stored in Prisma `Session` table hashed with SHA-256 (see apps/api/src/routes/auth.ts).
- **Authorization**: Org-level owner/member roles. Middleware ensures `organizationId` scoping. Add unit tests before GA.
- **Input validation**: zod schemas server-side; additional sanitization for metadata fields to prevent injection.
- **Encryption**: Sensitive n8n API keys encrypted using AES-256-GCM (apps/api/src/lib/encryption.ts).
- **Secure headers**: Next.js handles base headers; configure CSP/HSTS in production proxies (nginx/ALB). Document in infra README.
- **Secrets scanning**: Enable GitHub secret scanning or run `trufflehog` in CI.
- **Dependency updates**: pnpm audit weekly; lock updated via Renovate/Dependabot.

## 4. Monitoring & logging

- CloudWatch logs per ECS service; log retention 30 days.
- Metrics: ALB 4xx/5xx, RDS CPU, ECS task restarts. Create SNS alerts for thresholds.
- Audit logs stored in `AuditLog` table (workflow imports, settings changes, rollbacks, SSO logins).
- Incident timeline (apps/web monitoring page) consolidates errors/deploys.

## 5. Data protection & GDPR

- Data inventory and retention described in privacy policy.
- Data subject requests tracked via ticketing (Notion/Jira). 30-day SLA.
- Customers can delete snapshots/instances; final deletion runs cascading SQL + S3 cleanup.
- DPA required for enterprise customers—template TODO.

## 6. Vendor management

- Maintain sub-processor list (privacy policy). Evaluate SOC 2 / ISO certificates yearly.
- Monitor AWS Security Bulletins; apply critical patches within 48h.

## 7. Open tasks

- [ ] Incident response plan (roles, comms templates).
- [ ] Penetration test before GA (3rd party).  
- [ ] Formal change management log (CI/CD approvals).  
- [ ] Automate CIS AWS Foundations checks (Prowler or AWS Security Hub).

Keep this file updated whenever infra or policies change; link to it in investor/security questionnaires.
