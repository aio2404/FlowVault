# Ansible Runbooks

Use these playbooks for operational tasks that sit on top of the Terraform baseline (run migrations, seed data, rotate environment files, trigger ECS one-off tasks, etc.).

## Structure

```
infra/ansible/
├── inventory/
│   └── example.aws_ecs.yml   # Dynamic inventory using the AWS collection
├── group_vars/
│   └── all.yml               # Shared variables (cluster name, region, etc.)
├── playbooks/
│   ├── run-migrations.yml    # Runs Prisma migrations via a one-off ECS task
│   ├── deploy-config.yml     # Pushes .env files / secrets to SSM
│   └── smoke-test.yml        # Post-deploy health checks against API/Web
├── roles/
│   └── ssm-parameters/       # Example role encapsulating SSM writes
├── requirements.yml          # Ansible collections needed (amazon.aws, community.aws)
└── ansible.cfg               # Convenience defaults
```

## Quick start

```bash
cd infra/ansible
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt  # installs ansible-core
ansible-galaxy collection install -r requirements.yml

# Export AWS credentials / use an IAM profile that can call ECS + SSM
export AWS_PROFILE=n8nback-dev

# Run migrations
ansible-playbook -i inventory/example.aws_ecs.yml playbooks/run-migrations.yml \
  -e "service_name=n8nback-api image_tag=latest"

# Basic smoke test (no inventory needed, runs locally)
FLOWVAULT_API_URL=https://api.example.com \
FLOWVAULT_WEB_URL=https://app.example.com \
ansible-playbook playbooks/smoke-test.yml
```

### `run-migrations.yml`

1. Looks up the ECS cluster + task definition defined in Terraform outputs.
2. Starts a one-off Fargate task (same image as the API) overriding the command to `pnpm --filter @n8nback/api exec prisma migrate deploy`.
3. Streams logs until completion.

### `deploy-config.yml`

Demonstrates how to push key/value secrets into AWS Systems Manager Parameter Store. Terraform (or the ECS task definition) can later reference these parameters as environment variables.

## Requirements

- `ansible-core >= 2.15`
- AWS credentials with permissions for ECS (`ecs:RunTask`, `iam:PassRole`), CloudWatch Logs, and SSM.
- Python dependencies defined in `requirements.txt` (boto3/botocore).

## Customisation ideas

- Add roles/playbooks for blue/green ECS deployments, log snapshotting, or incident response.
- Integrate with CI to automatically run migrations after Terraform applies (using `ansible-playbook` inside the pipeline).
- Use dynamic inventory + tags to target bastion hosts if you maintain stateful components.
