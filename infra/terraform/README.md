# Terraform Deployment Blueprint (AWS)

This folder contains an opinionated baseline for deploying **n8nBack** on AWS with Terraform.  
It provisions the core infrastructure (network, database, container orchestration, registries, etc.) and leaves hooks for configuration management via Ansible.

> **Status:** Skeleton. You still need to fill in real values (CIDRs, domain names, certificates, secrets) and wire the CI/CD workflow that builds container images.

---

## Target architecture

```
┌──────────────── AWS Account ────────────────┐
│                                             │
│  VPC (multi-AZ)                             │
│  ├─ Public subnets (2)                      │
│  │   └─ ALB + NAT Gateways                  │
│  └─ Private subnets (2)                     │
│      ├─ ECS Fargate cluster                 │
│      │   ├─ Service #1: API (Fastify)       │
│      │   ├─ Service #2: Web (Next.js)       │
│      │   └─ Service #3: Workers (optional)  │
│      ├─ Amazon RDS (PostgreSQL)             │
│      └─ AWS Secrets Manager / SSM Parameters│
│                                             │
│  Supporting infra:                          │
│    • ECR registries for API/WEB/Worker      │
│    • CloudWatch Logs + metrics alarms       │
│    • S3 bucket for static exports / backups │
│                                             │
└─────────────────────────────────────────────┘
```

## Structure

```
infra/
└── terraform/
    ├── main.tf                 # Root module orchestrating the stack
    ├── variables.tf
    ├── outputs.tf
    ├── terraform.tfvars.example
    └── modules/
        ├── network/            # VPC, subnets, routing, security groups
        ├── rds/                # PostgreSQL instance + SG + snapshots
        ├── ecr/                # Container registries for images
        ├── ecs-cluster/        # ECS cluster + CloudWatch log groups
        └── ecs-service/        # Re-usable Fargate service definition
```

## Usage

1. **Install dependencies**  
   - Terraform ≥ 1.6  
   - AWS CLI configured with credentials (use an IAM role with enough rights).

2. **Copy the tfvars template**
   ```bash
   cd infra/terraform
   cp terraform.tfvars.example terraform.tfvars
   # edit with your CIDRs, domain, database credentials, etc.
   ```

3. **(Optional) Configure remote state**  
   Uncomment/adapt the `backend "s3"` block in `main.tf` to store state in S3 + DynamoDB.

4. **Plan & apply**
   ```bash
   terraform init
   terraform plan   # review the changes
   terraform apply  # provision resources
   ```

5. **Build & push containers**
   - Use your CI to build Docker images from `infra/Dockerfile.*`.
   - Push to the ECR repos created by `module.ecr`.

6. **Configure secrets**  
   - Write app secrets to AWS Secrets Manager / SSM Parameter Store.
   - Update ECS task definitions with the secret ARNs (placeholders exist).

7. **Deploy tasks**  
   - Update `container_image` variables to point to pushed images (`<aws_account>.dkr.ecr.<region>.amazonaws.com/n8nback-api:<tag>`).
   - Re-run `terraform apply` to roll out new task definitions.

## Next steps / TODO

- Add Route53/ACM resources if you need HTTPS + custom domains.
- Hook CI/CD (GitHub Actions, GitLab, etc.) to run Terraform plans and publish images automatically.
- Tune autoscaling policies for ECS services and RDS instance classes for production traffic.
- Review security (WAF, Shield, IAM least privilege, VPC endpoints).
- Integrate monitoring/alerting (CloudWatch alarms, SNS topics, PagerDuty).

## Ansible bridge

See `infra/ansible/README.md` for post-provision tasks (running Prisma migrations, seeding data, rotating secrets, etc.). Ansible can call AWS modules to trigger one-off ECS tasks on the resources created by this Terraform stack.
