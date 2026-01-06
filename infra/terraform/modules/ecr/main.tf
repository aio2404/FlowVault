locals {
  repos = { for repo in var.repositories : repo.name => repo }
}

resource "aws_ecr_repository" "this" {
  for_each = local.repos

  name                 = "${var.name_prefix}-${each.value.name}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-${each.value.name}-repo" })
}
