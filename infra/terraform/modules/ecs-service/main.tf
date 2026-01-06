locals {
  env_list = [
    for k, v in var.environment : {
      name  = k
      value = v
    }
  ]
}

data "aws_iam_policy_document" "task_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "task" {
  name               = "${var.name_prefix}-task"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json

  tags = merge(var.tags, { Name = "${var.name_prefix}-task-role" })
}

resource "aws_iam_role" "execution" {
  name               = "${var.name_prefix}-exec"
  assume_role_policy = data.aws_iam_policy_document.task_assume_role.json

  tags = merge(var.tags, { Name = "${var.name_prefix}-exec-role" })
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  for_each = toset(var.execution_role_policy_arns)

  policy_arn = each.value
  role       = aws_iam_role.execution.name
}

resource "aws_iam_role_policy_attachment" "task_managed" {
  for_each = toset(var.task_role_policy_arns)

  policy_arn = each.value
  role       = aws_iam_role.task.name
}

resource "aws_ecs_task_definition" "this" {
  family                   = var.name_prefix
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "${var.name_prefix}-container"
      image     = var.container_image
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = var.log_group_name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = var.name_prefix
        }
      }

      environment = local.env_list
      secrets     = var.secrets
    }
  ])

  tags = merge(var.tags, { Name = var.name_prefix })
}

data "aws_region" "current" {}

resource "aws_ecs_service" "this" {
  name            = var.name_prefix
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  dynamic "load_balancer" {
    for_each = var.enable_load_balancer && var.target_group_arn != null ? [1] : []
    content {
      target_group_arn = var.target_group_arn
      container_name   = "${var.name_prefix}-container"
      container_port   = var.container_port
    }
  }

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = var.assign_public_ip
  }

  lifecycle {
    ignore_changes = [
      desired_count,
    ]
  }

  tags = merge(var.tags, { Name = var.name_prefix })
}
