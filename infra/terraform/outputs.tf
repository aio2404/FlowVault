output "vpc_id" {
  value       = module.network.vpc_id
  description = "ID of the created VPC"
}

output "public_subnet_ids" {
  value = module.network.public_subnet_ids
}

output "private_subnet_ids" {
  value = module.network.private_subnet_ids
}

output "alb_dns_name" {
  value = aws_lb.app.dns_name
}

output "ecs_cluster_arn" {
  value = module.ecs_cluster.cluster_arn
}

output "rds_endpoint" {
  value       = module.rds.endpoint
  description = "PostgreSQL hostname"
}

output "ecr_repositories" {
  value       = module.ecr.repositories
  description = "Map of ECR repository names and ARNs"
}
