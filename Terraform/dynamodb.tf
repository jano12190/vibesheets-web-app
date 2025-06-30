# DynamoDB table for time entries
resource "aws_dynamodb_table" "time_entries" {
  name           = "${var.project_name}-time-entries-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "user_id"
  range_key      = "timestamp"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "date"
    type = "S"
  }

  # Global Secondary Index for querying by date
  global_secondary_index {
    name     = "DateIndex"
    hash_key = "user_id"
    range_key = "date"
    projection_type = "ALL"
  }

  tags = {
    Name        = "${var.project_name}-time-entries"
    Environment = var.environment
  }
}

# DynamoDB table for user settings/preferences
resource "aws_dynamodb_table" "user_settings" {
  name         = "${var.project_name}-user-settings-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  tags = {
    Name        = "${var.project_name}-user-settings"
    Environment = var.environment
  }
}

# DynamoDB table for tracking active sessions (clock in/out status)
resource "aws_dynamodb_table" "user_sessions" {
  name         = "${var.project_name}-user-sessions-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  tags = {
    Name        = "${var.project_name}-user-sessions"
    Environment = var.environment
  }
}