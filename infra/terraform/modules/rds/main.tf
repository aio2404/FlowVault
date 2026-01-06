resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db-subnet"
  subnet_ids = var.subnet_ids

  tags = merge(var.tags, { Name = "${var.name_prefix}-db-subnets" })
}

resource "aws_security_group" "rds" {
  name        = "${var.name_prefix}-rds"
  description = "Allow app traffic to PostgreSQL"
  vpc_id      = var.vpc_id

  ingress {
    description      = "PostgreSQL"
    from_port        = 5432
    to_port          = 5432
    protocol         = "tcp"
    security_groups  = var.ingress_security_group_ids
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-rds-sg" })
}

resource "aws_db_instance" "this" {
  identifier              = "${var.name_prefix}-pg"
  engine                  = "postgres"
  engine_version          = "15.5"
  instance_class          = var.instance_class
  username                = var.username
  password                = var.password
  db_name                 = var.db_name
  allocated_storage       = var.allocated_storage
  storage_encrypted       = true
  multi_az                = false
  publicly_accessible     = false
  vpc_security_group_ids  = [aws_security_group.rds.id]
  db_subnet_group_name    = aws_db_subnet_group.this.name
  backup_retention_period = 7
  deletion_protection     = true
  skip_final_snapshot     = false

  tags = merge(var.tags, { Name = "${var.name_prefix}-postgres" })
}
