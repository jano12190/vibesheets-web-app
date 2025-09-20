# IAM role for Lambda functions
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy for Lambda functions
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-lambda-policy-${var.environment}"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.time_entries.arn,
          "${aws_dynamodb_table.time_entries.arn}/index/*",
          aws_dynamodb_table.user_settings.arn,
          aws_dynamodb_table.user_sessions.arn,
          aws_dynamodb_table.projects.arn,
          "${aws_dynamodb_table.projects.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.auth_config.arn,
          aws_secretsmanager_secret.stripe_config.arn
        ]
      }
    ]
  })
}

# Auth configuration function
resource "aws_lambda_function" "auth_config" {
  filename         = "auth_config.zip"
  function_name    = "${var.project_name}-auth-config-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      SECRET_ARN  = aws_secretsmanager_secret.auth_config.arn
      DOMAIN_NAME = var.domain_name
    }
  }

  depends_on = [data.archive_file.auth_config_zip]
}

# Clock in/out function
resource "aws_lambda_function" "clock_in_out" {
  filename         = "clock_in_out.zip"
  function_name    = "${var.project_name}-clock-in-out-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      TIME_ENTRIES_TABLE = aws_dynamodb_table.time_entries.name
      USER_SESSIONS_TABLE = aws_dynamodb_table.user_sessions.name
      SECRET_ARN         = aws_secretsmanager_secret.auth_config.arn
    }
  }

  depends_on = [data.archive_file.clock_in_out_zip]
}

# Clock status function
resource "aws_lambda_function" "clock_status" {
  filename         = "clock_status.zip"
  function_name    = "${var.project_name}-clock-status-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      USER_SESSIONS_TABLE = aws_dynamodb_table.user_sessions.name
      SECRET_ARN         = aws_secretsmanager_secret.auth_config.arn
    }
  }

  depends_on = [data.archive_file.clock_status_zip]
}

# Get timesheets function
resource "aws_lambda_function" "get_timesheets" {
  filename         = "get_timesheets.zip"
  function_name    = "${var.project_name}-get-timesheets-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      TIME_ENTRIES_TABLE = aws_dynamodb_table.time_entries.name
      SECRET_ARN         = aws_secretsmanager_secret.auth_config.arn
    }
  }

  depends_on = [data.archive_file.get_timesheets_zip]
}

# Update timesheet function
resource "aws_lambda_function" "update_timesheet" {
  filename         = "update_timesheet.zip"
  function_name    = "${var.project_name}-update-timesheet-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      TIME_ENTRIES_TABLE = aws_dynamodb_table.time_entries.name
      SECRET_ARN         = aws_secretsmanager_secret.auth_config.arn
    }
  }

  depends_on = [data.archive_file.update_timesheet_zip]
}

# Export timesheet function
resource "aws_lambda_function" "export_timesheet" {
  filename         = "export_timesheet.zip"
  function_name    = "${var.project_name}-export-timesheet-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 60

  environment {
    variables = {
      TIME_ENTRIES_TABLE = aws_dynamodb_table.time_entries.name
      SECRET_ARN         = aws_secretsmanager_secret.auth_config.arn
    }
  }

  depends_on = [data.archive_file.export_timesheet_zip]
}

# Archive files for Lambda deployment packages
data "archive_file" "auth_config_zip" {
  type        = "zip"
  output_path = "auth_config.zip"
  source {
    content  = file("${path.module}/lambda_functions/auth_config.py")
    filename = "lambda_function.py"
  }
}

data "archive_file" "clock_in_out_zip" {
  type        = "zip"
  output_path = "clock_in_out.zip"
  source_dir  = "${path.module}/lambda_packages/clock_in_out"
}

data "archive_file" "clock_status_zip" {
  type        = "zip"
  output_path = "clock_status.zip"
  source_dir  = "${path.module}/lambda_packages/clock_status"
}

data "archive_file" "get_timesheets_zip" {
  type        = "zip"
  output_path = "get_timesheets.zip"
  source_dir  = "${path.module}/lambda_packages/get_timesheets"
}

data "archive_file" "update_timesheet_zip" {
  type        = "zip"
  output_path = "update_timesheet.zip"
  source {
    content  = file("${path.module}/lambda_functions/update_timesheet.py")
    filename = "lambda_function.py"
  }
}

data "archive_file" "export_timesheet_zip" {
  type        = "zip"
  output_path = "export_timesheet.zip"
  source {
    content  = file("${path.module}/lambda_functions/export_timesheet.py")
    filename = "lambda_function.py"
  }
}

# Stripe configuration function
resource "aws_lambda_function" "stripe_config" {
  filename         = "stripe_config.zip"
  function_name    = "${var.project_name}-stripe-config-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      STRIPE_SECRET_NAME = aws_secretsmanager_secret.stripe_config.name
      ENVIRONMENT        = var.environment
    }
  }

  depends_on = [data.archive_file.stripe_config_zip]
}

# Stripe payment intent function
resource "aws_lambda_function" "stripe_payment_intent" {
  filename         = "stripe_payment_intent.zip"
  function_name    = "${var.project_name}-stripe-payment-intent-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      STRIPE_SECRET_NAME  = aws_secretsmanager_secret.stripe_config.name
      USER_SETTINGS_TABLE = aws_dynamodb_table.user_settings.name
      ENVIRONMENT         = var.environment
    }
  }

  depends_on = [data.archive_file.stripe_payment_intent_zip]
}

# Stripe webhook function
resource "aws_lambda_function" "stripe_webhook" {
  filename         = "stripe_webhook.zip"
  function_name    = "${var.project_name}-stripe-webhook-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      STRIPE_SECRET_NAME  = aws_secretsmanager_secret.stripe_config.name
      USER_SETTINGS_TABLE = aws_dynamodb_table.user_settings.name
      ENVIRONMENT         = var.environment
    }
  }

  depends_on = [data.archive_file.stripe_webhook_zip]
}

# Archive files for Stripe Lambda functions
data "archive_file" "stripe_config_zip" {
  type        = "zip"
  output_path = "stripe_config.zip"
  source {
    content  = file("${path.module}/lambda_functions/stripe_config.py")
    filename = "lambda_function.py"
  }
}

data "archive_file" "stripe_payment_intent_zip" {
  type        = "zip"
  output_path = "stripe_payment_intent.zip"
  source_dir  = "${path.module}/lambda_packages/stripe_payment_intent"
}

data "archive_file" "stripe_webhook_zip" {
  type        = "zip"
  output_path = "stripe_webhook.zip"
  source_dir  = "${path.module}/lambda_packages/stripe_webhook"
}

# Stripe setup intent function
resource "aws_lambda_function" "stripe_setup_intent" {
  filename         = "stripe_setup_intent.zip"
  function_name    = "${var.project_name}-stripe-setup-intent-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      STRIPE_SECRET_NAME = aws_secretsmanager_secret.stripe_config.name
      ENVIRONMENT        = var.environment
    }
  }

  depends_on = [data.archive_file.stripe_setup_intent_zip]
}

data "archive_file" "stripe_setup_intent_zip" {
  type        = "zip"
  output_path = "stripe_setup_intent.zip"
  source_dir  = "${path.module}/lambda_packages/stripe_setup_intent"
}

# Project Management Lambda Functions

# Create project function
resource "aws_lambda_function" "create_project" {
  filename         = "create_project.zip"
  function_name    = "${var.project_name}-create-project-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      PROJECTS_TABLE = aws_dynamodb_table.projects.name
      SECRET_ARN     = aws_secretsmanager_secret.auth_config.arn
    }
  }

  depends_on = [data.archive_file.create_project_zip]
}

# Get projects function
resource "aws_lambda_function" "get_projects" {
  filename         = "get_projects.zip"
  function_name    = "${var.project_name}-get-projects-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      PROJECTS_TABLE = aws_dynamodb_table.projects.name
      SECRET_ARN     = aws_secretsmanager_secret.auth_config.arn
    }
  }

  depends_on = [data.archive_file.get_projects_zip]
}

# Update project function
resource "aws_lambda_function" "update_project" {
  filename         = "update_project.zip"
  function_name    = "${var.project_name}-update-project-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      PROJECTS_TABLE = aws_dynamodb_table.projects.name
      SECRET_ARN     = aws_secretsmanager_secret.auth_config.arn
    }
  }

  depends_on = [data.archive_file.update_project_zip]
}

# Delete project function
resource "aws_lambda_function" "delete_project" {
  filename         = "delete_project.zip"
  function_name    = "${var.project_name}-delete-project-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      PROJECTS_TABLE = aws_dynamodb_table.projects.name
      SECRET_ARN     = aws_secretsmanager_secret.auth_config.arn
    }
  }

  depends_on = [data.archive_file.delete_project_zip]
}

# Archive files for project Lambda functions
data "archive_file" "create_project_zip" {
  type        = "zip"
  output_path = "create_project.zip"
  source_dir  = "${path.module}/lambda_packages/create_project"
}

data "archive_file" "get_projects_zip" {
  type        = "zip"
  output_path = "get_projects.zip"
  source_dir  = "${path.module}/lambda_packages/get_projects"
}

data "archive_file" "update_project_zip" {
  type        = "zip"
  output_path = "update_project.zip"
  source_dir  = "${path.module}/lambda_packages/update_project"
}

data "archive_file" "delete_project_zip" {
  type        = "zip"
  output_path = "delete_project.zip"
  source_dir  = "${path.module}/lambda_packages/delete_project"
}