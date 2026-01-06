variable "name_prefix" {
  type = string
}

variable "repositories" {
  description = "List of repositories to create"
  type = list(object({
    name = string
  }))
}

variable "tags" {
  type = map(string)
}
