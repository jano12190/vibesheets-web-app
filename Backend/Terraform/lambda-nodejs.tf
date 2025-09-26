# Node.js Lambda Functions with MongoDB

# Updated IAM policy for Lambda functions (MongoDB connection + Secrets Manager)
resource "aws_iam_role_policy" "lambda_nodejs_policy" {
  name = "${var.project_name}-lambda-nodejs-policy-${var.environment}"
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
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.mongodb_config.arn,
          aws_secretsmanager_secret.auth_config.arn
        ]
      }
    ]
  })
}

# Secrets are managed in secrets.tf file - removed duplicates here

# Build script for Node.js Lambda packages
resource "null_resource" "build_nodejs_lambdas" {
  triggers = {
    # Trigger rebuild when any JS file changes
    js_files_hash = sha256(join("", [for f in fileset("${path.module}/lambda_functions", "*.js") : filesha256("${path.module}/lambda_functions/${f}")]))
    package_json_hash = filesha256("${path.module}/lambda_functions/package.json")
  }

  provisioner "local-exec" {
    command = "${path.module}/build_nodejs_lambdas.sh"
    working_dir = path.module
  }
}

# Auth configuration function (Node.js)
resource "aws_lambda_function" "auth_config_nodejs" {
  filename         = "${path.module}/lambda_packages/auth_config_nodejs.zip"
  function_name    = "${var.project_name}-auth-config-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "auth_config.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      AUTH0_DOMAIN      = var.auth0_domain
      AUTH0_CLIENT_ID   = var.auth0_client_id
      AUTH0_AUDIENCE    = var.auth0_audience
      AUTH0_REDIRECT_URI = "https://${var.domain_name}/dashboard"
      GOOGLE_CLIENT_ID  = var.google_client_id
      API_BASE_URL      = "https://api.${var.domain_name}"
      ALLOWED_ORIGINS   = var.allowed_origins != "" ? var.allowed_origins : "https://${var.domain_name}"
    }
  }

  depends_on = [null_resource.build_nodejs_lambdas]
}

# Clock status function (Node.js)
resource "aws_lambda_function" "clock_status_nodejs" {
  filename         = "${path.module}/lambda_packages/clock_status_nodejs.zip"
  function_name    = "${var.project_name}-clock-status-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "clock_status.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      AUTH_SECRET_NAME    = aws_secretsmanager_secret.auth_config.name
      MONGODB_SECRET_NAME = aws_secretsmanager_secret.mongodb_config.name
      AWS_REGION         = var.aws_region
      ALLOWED_ORIGINS    = var.allowed_origins != "" ? var.allowed_origins : "https://${var.domain_name}"
    }
  }

  depends_on = [null_resource.build_nodejs_lambdas]
}

# Clock in/out function (Node.js)
resource "aws_lambda_function" "clock_in_out_nodejs" {
  filename         = "${path.module}/lambda_packages/clock_in_out_nodejs.zip"
  function_name    = "${var.project_name}-clock-in-out-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "clock_in_out.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      AUTH_SECRET_NAME    = aws_secretsmanager_secret.auth_config.name
      MONGODB_SECRET_NAME = aws_secretsmanager_secret.mongodb_config.name
      AWS_REGION         = var.aws_region
      ALLOWED_ORIGINS    = var.allowed_origins != "" ? var.allowed_origins : "https://${var.domain_name}"
    }
  }

  depends_on = [null_resource.build_nodejs_lambdas]
}

# Get timesheets function (Node.js)
resource "aws_lambda_function" "get_timesheets_nodejs" {
  filename         = "${path.module}/lambda_packages/get_timesheets_nodejs.zip"
  function_name    = "${var.project_name}-get-timesheets-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "get_timesheets.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      AUTH_SECRET_NAME    = aws_secretsmanager_secret.auth_config.name
      MONGODB_SECRET_NAME = aws_secretsmanager_secret.mongodb_config.name
      AWS_REGION         = var.aws_region
      ALLOWED_ORIGINS    = var.allowed_origins != "" ? var.allowed_origins : "https://${var.domain_name}"
    }
  }

  depends_on = [null_resource.build_nodejs_lambdas]
}

# Update timesheet function (Node.js)
resource "aws_lambda_function" "update_timesheet_nodejs" {
  filename         = "${path.module}/lambda_packages/update_timesheet_nodejs.zip"
  function_name    = "${var.project_name}-update-timesheet-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "update_timesheet.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      AUTH_SECRET_NAME    = aws_secretsmanager_secret.auth_config.name
      MONGODB_SECRET_NAME = aws_secretsmanager_secret.mongodb_config.name
      AWS_REGION         = var.aws_region
      ALLOWED_ORIGINS    = var.allowed_origins != "" ? var.allowed_origins : "https://${var.domain_name}"
    }
  }

  depends_on = [null_resource.build_nodejs_lambdas]
}

# Export timesheet function (Node.js)
resource "aws_lambda_function" "export_timesheet_nodejs" {
  filename         = "${path.module}/lambda_packages/export_timesheet_nodejs.zip"
  function_name    = "${var.project_name}-export-timesheet-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "export_timesheet.handler"
  runtime         = "nodejs18.x"
  timeout         = 60

  environment {
    variables = {
      AUTH_SECRET_NAME    = aws_secretsmanager_secret.auth_config.name
      MONGODB_SECRET_NAME = aws_secretsmanager_secret.mongodb_config.name
      AWS_REGION         = var.aws_region
      ALLOWED_ORIGINS    = var.allowed_origins != "" ? var.allowed_origins : "https://${var.domain_name}"
    }
  }

  depends_on = [null_resource.build_nodejs_lambdas]
}

# Get projects function (Node.js)
resource "aws_lambda_function" "get_projects_nodejs" {
  filename         = "${path.module}/lambda_packages/get_projects_nodejs.zip"
  function_name    = "${var.project_name}-get-projects-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "get_projects.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      AUTH_SECRET_NAME    = aws_secretsmanager_secret.auth_config.name
      MONGODB_SECRET_NAME = aws_secretsmanager_secret.mongodb_config.name
      AWS_REGION         = var.aws_region
      ALLOWED_ORIGINS    = var.allowed_origins != "" ? var.allowed_origins : "https://${var.domain_name}"
    }
  }

  depends_on = [null_resource.build_nodejs_lambdas]
}

# Create project function (Node.js)
resource "aws_lambda_function" "create_project_nodejs" {
  filename         = "${path.module}/lambda_packages/create_project_nodejs.zip"
  function_name    = "${var.project_name}-create-project-${var.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "create_project.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  environment {
    variables = {
      AUTH_SECRET_NAME    = aws_secretsmanager_secret.auth_config.name
      MONGODB_SECRET_NAME = aws_secretsmanager_secret.mongodb_config.name
      AWS_REGION         = var.aws_region
      ALLOWED_ORIGINS    = var.allowed_origins != "" ? var.allowed_origins : "https://${var.domain_name}"
    }
  }

  depends_on = [null_resource.build_nodejs_lambdas]
}