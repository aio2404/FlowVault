# Platform & Infrastructure Guide

This document explains how to deploy FlowVault (n8nBack) across environments, what AWS services are involved, and how to keep costs predictable while you scale.

## Environments

| Env | Purpose | Notes |
|-----|---------|-------|
| `dev` | Shared playground, hit docker-compose locally. | Uses `docker compose up` (see `infra/docker-compose.yml`). |
| `staging` | Mirrors production topology on a smaller instance class. | Terraform workspace `staging`, RDS `db.t4g.small`, ECS desired count = 1. |
| `prod` | Customer-facing cluster across two AZs. | Terraform workspace `prod`, ECS desired count = 2+, RDS `db.m6g.large` or Aurora. |

## AWS Architecture (Terraform)

Component summary (see `infra/terraform` for code):

- **Networking** – VPC with two public subnets (ALB/NAT) + two private subnets (ECS/RDS). Security groups restrict traffic (ALB → ECS, ECS → RDS).
- **Compute** – ECS Fargate cluster running three services: API (Fastify), Web (Next.js), Worker (BullMQ). A single ALB fronts API + Web target groups.
- **Data** – Amazon RDS (PostgreSQL) with automated backups, encrypted at rest. Optionally connect to Amazon ElastiCache/MemoryDB for Redis-compatible queue.
- **Images** – ECR repositories per component (API/Web/Worker). CI pushes tags (`git sha`) before Terraform updates ECS task definitions.
- **Secrets & Config** – AWS Secrets Manager or SSM Parameter Store referenced via ECS task definitions. Ansible playbooks can push `.env` style secrets.
- **Observability** – CloudWatch log groups from `ecs-cluster` module, plus metrics/alarms TODO placeholders (add SNS hooks before GA).

## Deployment Flow

1. **Provision base infra:**  
   ```bash
   cd infra/terraform
   terraform workspace select staging || terraform workspace new staging
   terraform init
   terraform apply
   ```
2. **Build & publish images:**  
   Use CI (GitHub Actions) to build Dockerfiles in `infra/Dockerfile.*` and push to the ECR repos created by step 1.
3. **Update task definitions:**  
   Set `api_image`, `web_image`, `worker_image` in `terraform.tfvars` to the pushed tags, `terraform apply` again.
4. **Post-provision automation:**  
   Run Ansible to apply Prisma migrations, seed data, or run smoke tests (`infra/ansible/playbooks/*.yml`).

## Cost Guardrails

Approximate monthly costs (eu-west-3, USD):

| Tier | Compute | Database | Networking | Total |
|------|---------|----------|------------|-------|
| Starter (staging) | 2× Fargate tasks (0.5 vCPU/1GB) ≈ $35 | RDS db.t4g.small ≈ $55 | NAT + ALB ≈ $45 | ~$135 |
| Production | 4× Fargate tasks (1 vCPU/2GB) ≈ $140 | RDS db.m6g.large ≈ $220 | NAT + ALB + data transfer ≈ $120 | ~$480 |

Reduce costs for early days by:
- Turning off the worker service (BullMQ) until background jobs are critical.
- Running staging with a single AZ VPC + no NAT (if you accept lower redundancy).
- Removing NAT by using VPC endpoints for ECR/SSM (advanced).

## Disaster Recovery

- RDS automated backups (7 days) + manual snapshots monthly.
- S3 bucket for workflow exports/backups (see Terraform TODO).
- Documented restore procedure in `docs/runbooks/backups-and-dr.md`.

## Future Enhancements

- Add Route53 + ACM resources for HTTPS + vanity domains.
- Introduce AWS WAF + CloudFront in front of the ALB.
- Terraform modules for Redis (ElastiCache) and S3 backups.
- CI pipeline step to run `ansible-playbook playbooks/smoke-test.yml` after deploy.

Use this guide as the authoritative reference when onboarding DevOps teammates or planning infra audits.
