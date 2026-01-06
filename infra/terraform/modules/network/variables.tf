variable "name_prefix" {
  type = string
}

variable "cidr_block" {
  type = string
}

variable "public_subnets" {
  type = list(object({
    cidr = string
    az   = string
  }))
}

variable "private_subnets" {
  type = list(object({
    cidr = string
    az   = string
  }))
}

variable "enable_nat" {
  type    = bool
  default = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
