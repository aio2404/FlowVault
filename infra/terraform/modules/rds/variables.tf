variable "name_prefix" {
  type = string
}

variable "db_name" {
  type = string
}

variable "username" {
  type = string
}

variable "password" {
  type      = string
  sensitive = true
}

variable "instance_class" {
  type = string
}

variable "allocated_storage" {
  type = number
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "ingress_security_group_ids" {
  description = "Security groups allowed to connect to RDS"
  type        = list(string)
}

variable "tags" {
  type = map(string)
}
