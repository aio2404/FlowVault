variable "name_prefix" {
  type = string
}

variable "cluster_arn" {
  type = string
}

variable "desired_count" {
  type = number
}

variable "container_image" {
  type = string
}

variable "container_port" {
  type = number
}

variable "cpu" {
  type = number
}

variable "memory" {
  type = number
}

variable "environment" {
  description = "Environment variables map"
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "List of secrets from SSM/Secrets Manager"
  type = list(object({
    name      = string
    valueFrom = string
  }))
  default = []
}

variable "assign_public_ip" {
  type    = bool
  default = false
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_ids" {
  type = list(string)
}

variable "enable_load_balancer" {
  type    = bool
  default = true
}

variable "target_group_arn" {
  type      = string
  default   = null
}

variable "log_group_name" {
  type = string
}

variable "execution_role_policy_arns" {
  type    = list(string)
  default = []
}

variable "task_role_policy_arns" {
  type    = list(string)
  default = []
}

variable "tags" {
  type = map(string)
}
