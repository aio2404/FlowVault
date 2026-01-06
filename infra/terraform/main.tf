terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }

  # Uncomment and fill to store state remotely
  # backend "s3" {
  #   bucket = "your-tf-state-bucket"
  #   key    = "n8nback/terraform.tfstate"
  #   region = "eu-west-3"
  #   dynamodb_table = "terraform-locks"
  # }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  default_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

module "network" {
  source = "./modules/network"

  name_prefix     = local.name_prefix
  cidr_block      = var.vpc_cidr
  public_subnets  = var.public_subnets
  private_subnets = var.private_subnets
  enable_nat      = true

  tags = local.default_tags
}

module "ecr" {
  source = "./modules/ecr"

  name_prefix = local.name_prefix
  repositories = [
    { name = "api" },
    { name = "web" },
    { name = "worker" },
  ]

  tags = local.default_tags
}

module "rds" {
  source = "./modules/rds"

  name_prefix  = local.name_prefix
  db_name      = var.rds_db_name
  username     = var.rds_username
  password     = var.rds_password
  instance_class = var.rds_instance_class
  allocated_storage = var.rds_allocated_storage
  vpc_id       = module.network.vpc_id
  subnet_ids   = module.network.private_subnet_ids
  ingress_security_group_ids = [module.network.ecs_security_group_id]

  tags = local.default_tags
}

module "ecs_cluster" {
  source      = "./modules/ecs-cluster"
  name_prefix = local.name_prefix
  tags        = local.default_tags
}

# Shared ALB for API + WEB
resource "aws_lb" "app" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [module.network.alb_security_group_id]
  subnets            = module.network.public_subnet_ids

  tags = local.default_tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      status_code  = "404"
      message_body = "Not configured"
    }
  }
}

# Target groups per service
resource "aws_lb_target_group" "api" {
  name     = "${local.name_prefix}-api"
  port     = 3001
  protocol = "HTTP"
  vpc_id   = module.network.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    matcher             = "200-399"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 10
    interval            = 30
  }

  tags = local.default_tags
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api*", "/app/api*"]
    }
  }
}

resource "aws_lb_target_group" "web" {
  name        = "${local.name_prefix}-web"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.network.vpc_id
  target_type = "ip"

  health_check {
    path = "/"
  }

  tags = local.default_tags
}

resource "aws_lb_listener_rule" "web" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }

  condition {
    path_pattern {
      values = ["/*"]
    }
  }
}

module "api_service" {
  source = "./modules/ecs-service"

  name_prefix       = "${local.name_prefix}-api"
  cluster_arn       = module.ecs_cluster.cluster_arn
  desired_count     = 2
  container_image   = var.api_image
  container_port    = 3001
  environment       = merge(var.common_environment, var.api_environment)
  cpu               = 512
  memory            = 1024
  assign_public_ip  = false
  subnet_ids        = module.network.private_subnet_ids
  security_group_ids = [module.network.ecs_security_group_id]
  target_group_arn  = aws_lb_target_group.api.arn
  log_group_name    = module.ecs_cluster.log_group_name
  execution_role_policy_arns = var.execution_policy_arns
  task_role_policy_arns      = var.task_policy_arns

  tags = local.default_tags
}

module "web_service" {
  source = "./modules/ecs-service"

  name_prefix       = "${local.name_prefix}-web"
  cluster_arn       = module.ecs_cluster.cluster_arn
  desired_count     = 2
  container_image   = var.web_image
  container_port    = 3000
  environment       = merge(var.common_environment, var.web_environment)
  cpu               = 512
  memory            = 1024
  assign_public_ip  = false
  subnet_ids        = module.network.private_subnet_ids
  security_group_ids = [module.network.ecs_security_group_id]
  target_group_arn  = aws_lb_target_group.web.arn
  log_group_name    = module.ecs_cluster.log_group_name
  execution_role_policy_arns = var.execution_policy_arns
  task_role_policy_arns      = var.task_policy_arns

  tags = local.default_tags
}

module "worker_service" {
  source = "./modules/ecs-service"

  name_prefix       = "${local.name_prefix}-worker"
  cluster_arn       = module.ecs_cluster.cluster_arn
  desired_count     = var.worker_desired_count
  container_image   = var.worker_image
  container_port    = 3002
  environment       = merge(var.common_environment, var.worker_environment)
  cpu               = 512
  memory            = 1024
  assign_public_ip  = false
  subnet_ids        = module.network.private_subnet_ids
  security_group_ids = [module.network.ecs_security_group_id]
  log_group_name    = module.ecs_cluster.log_group_name
  execution_role_policy_arns = var.execution_policy_arns
  task_role_policy_arns      = var.task_policy_arns
  enable_load_balancer       = false

  tags = local.default_tags
}
