resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, { Name = "${var.name_prefix}-vpc" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, { Name = "${var.name_prefix}-igw" })
}

resource "aws_subnet" "public" {
  for_each = { for subnet in var.public_subnets : subnet.cidr => subnet }

  vpc_id                  = aws_vpc.this.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = true

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-public-${replace(each.value.az, var.name_prefix, "")}"
      Tier = "public"
    }
  )
}

resource "aws_subnet" "private" {
  for_each = { for subnet in var.private_subnets : subnet.cidr => subnet }

  vpc_id            = aws_vpc.this.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-private-${replace(each.value.az, var.name_prefix, "")}"
      Tier = "private"
    }
  )
}

resource "aws_eip" "nat" {
  count = var.enable_nat ? length(var.public_subnets) : 0

  domain = "vpc"

  tags = merge(var.tags, { Name = "${var.name_prefix}-nat-${count.index}" })
}

resource "aws_nat_gateway" "this" {
  count = var.enable_nat ? length(var.public_subnets) : 0

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = element(values(aws_subnet.public)[*].id, count.index)

  tags = merge(var.tags, { Name = "${var.name_prefix}-nat-${count.index}" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-public-rt" })
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id

  dynamic "route" {
    for_each = var.enable_nat ? aws_nat_gateway.this : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = route.value.id
    }
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-private-rt" })
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private.id
}

resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb"
  description = "ALB ingress"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-alb-sg" })
}

resource "aws_security_group" "ecs" {
  name        = "${var.name_prefix}-ecs"
  description = "Allow traffic from ALB to ECS tasks"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    security_groups = [aws_security_group.alb.id]
    description     = "Traffic from ALB"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-ecs-sg" })
}
