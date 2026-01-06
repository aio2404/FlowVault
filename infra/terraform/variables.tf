variable "aws_region" {
  description = "AWS region to deploy resources in"
  type        = string
  default     = "eu-west-3"
}

variable "aws_profile" {
  description = "Optional named profile for the AWS provider"
  type        = string
  default     = null
}

variable "project_name" {
  description = "Project tag/prefix"
  type        = string
  default     = "n8nback"
}

variable "environment" {
  description = "Deployment environment (dev/staging/prod)"
  type        = string
  default     = "dev"
}

variable "tags" {
  description = "Additional AWS tags"
  type        = map(string)
  default     = {}
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
}

variable "public_subnets" {
  description = "Public subnets definition"
  type = list(object({
    cidr = string
    az   = string
  }))
}

variable "private_subnets" {
  description = "Private subnets definition"
  type = list(object({
    cidr = string
    az   = string
  }))
}

variable "rds_db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "n8nback"
}

variable "rds_username" {
  description = "PostgreSQL username"
  type        = string
}

variable "rds_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "rds_allocated_storage" {
  description = "RDS storage in GB"
  type        = number
  default     = 20
}

variable "api_image" {
  description = "Full ECR image URI for the API service"
  type        = string
}

variable "web_image" {
  description = "Full ECR image URI for the web service"
  type        = string
}

variable "worker_image" {
  description = "Full ECR image URI for background worker"
  type        = string
  default     = ""
}

variable "worker_desired_count" {
  description = "Number of worker tasks"
  type        = number
  default     = 1
}

variable "common_environment" {
  description = "Environment variables shared across all services"
  type        = map(string)
  default     = {}
}

variable "api_environment" {
  description = "Additional env vars for the API service"
  type        = map(string)
  default     = {}
}

variable "web_environment" {
  description = "Additional env vars for the web service"
  type        = map(string)
  default     = {}
}

variable "worker_environment" {
  description = "Additional env vars for worker service"
  type        = map(string)
  default     = {}
}

variable "execution_policy_arns" {
  description = "IAM policies attached to the ECS execution role"
  type        = list(string)
  default     = []
}

variable "task_policy_arns" {
  description = "IAM policies attached to the ECS task role"
  type        = list(string)
  default     = []
}
