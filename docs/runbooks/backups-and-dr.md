# Backup & Disaster Recovery Runbook

> Goal: ensure we can restore customer data (workflows, executions, settings) within the defined RPO/RTO.

## 1. Scope

- PostgreSQL (RDS) – authoritative source for users, orgs, workflows, versions, executions.
- Object storage (S3) – optional exports or attachment storage (future).
- Infrastructure state – Terraform state + Git repository.

## 2. Backup strategy

| Component | Method | Frequency | Retention |
|-----------|--------|-----------|-----------|
| RDS PostgreSQL | Automated snapshots + PITR (AWS-managed) | Daily snapshot + continuous WAL | 7 days (auto), weekly manual snapshot kept 30 days |
| RDS manual snapshot | Trigger via Ansible (`run-migrations.yml` adaptation) | Weekly, before schema migrations | 30 days |
| Prisma schema & config | Git repository | Continuous | Forever |
| Terraform state | S3 bucket with versioning + DynamoDB lock | Continuous | 90 days |
| Application exports (optional) | `pnpm db:export` (custom script) -> S3 glacier | Monthly | 1 year |

### Automation

- Enable automated backups in Terraform by setting `backup_retention_period` > 7 and `preferred_backup_window`.
- Use AWS Backup plan (optional) for centralized policy.
- Ansible playbook `playbooks/run-migrations.yml` can be adapted to call `aws rds create-db-snapshot` before risky changes.

## 3. Restoration procedure

1. **Identify incident**
   - Triggered via CloudWatch alarm, monitoring, or user ticket.
   - Log incident in tracker (Notion/Jira) with timestamp.
2. **Decide restore point**
   - For logical corruption: pick latest snapshot before incident (`describe-db-snapshots`).
   - For accidental delete: use point-in-time restore (PITR) to the second before event.
3. **Restore RDS**
   - `aws rds restore-db-instance-to-point-in-time --source-db-instance-identifier n8nback-prod --target-db-instance-identifier n8nback-prod-restore --use-latest-restorable-time`
   - Wait for instance available.
4. **Swap DNS / connection strings**
   - Update ECS secrets/parameters to point to restored instance OR promote restored instance to be the new primary (rename).
   - Re-run Terraform/Ansible to update connection details.
5. **Application verification**
   - Run smoke tests (login, list workflows, diff) to confirm functionality.
   - Validate data integrity (count workflows vs. expected).
6. **Post-mortem**
   - Document root cause, time to detect, time to recover, preventive actions.

## 4. Testing

- **Quarterly**: simulate restoration by spinning up a clone DB from snapshot and running integration tests.
- **Before GA**: run full DR drill (restore DB + redeploy ECS) to verify RTO < 4h.

## 5. Responsibilities

| Role | Task |
|------|------|
| On-call engineer | Trigger backup/restore, coordinate comms |
| CTO | Approve failover, communicate with customers |
| DPO | Evaluate breach notification obligations if personal data affected |

## 6. Tooling & scripts

- `infra/terraform` – ensures RDS has snapshots + encryption.
- `infra/ansible/playbooks/run-migrations.yml` – template to run `prisma migrate deploy` or `pg_dump`.
- TODO: add `scripts/db-backup.sh` that wraps `pg_dump` via bastion/SSM for ad-hoc exports.

Keep this runbook updated whenever infrastructure changes (region switch, multi-AZ, etc.). Store contact info + AWS account IDs in a private doc for the incident response team.
