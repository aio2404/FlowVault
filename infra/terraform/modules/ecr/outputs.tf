output "repositories" {
  value = {
    for name, repo in aws_ecr_repository.this :
    name => {
      repository_url = repo.repository_url
      arn            = repo.arn
    }
  }
}
