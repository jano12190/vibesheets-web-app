# AWS Secrets Manager Configuration

# Random string for policy name uniqueness
resource "random_string" "policy_suffix" {
  length  = 8
  special = false
  upper   = false
}

# OAuth credentials secret
resource "aws_secretsmanager_secret" "oauth_credentials" {
  name                    = "${var.app_name}/oauth-credentials"
  description             = "OAuth credentials for ${var.app_name} application"
  recovery_window_in_days = 7

  tags = var.common_tags
}

# Auth0 credentials secret
resource "aws_secretsmanager_secret" "auth0_credentials" {
  name                    = "${var.app_name}/auth0-credentials"
  description             = "Auth0 credentials for ${var.app_name} application"
  recovery_window_in_days = 7

  tags = var.common_tags
}

# Data sources for retrieving secrets
data "aws_secretsmanager_secret_version" "auth0_secrets" {
  secret_id = aws_secretsmanager_secret.auth0_credentials.id
}

data "aws_secretsmanager_secret_version" "oauth_secrets" {
  secret_id = aws_secretsmanager_secret.oauth_credentials.id
}

# Local values for parsed secrets
locals {
  auth0_secrets = jsondecode(data.aws_secretsmanager_secret_version.auth0_secrets.secret_string)
  oauth_secrets = jsondecode(data.aws_secretsmanager_secret_version.oauth_secrets.secret_string)
}

# IAM policy for accessing secrets
resource "aws_iam_policy" "secrets_access" {
  name        = "vibesheets-secrets-access-${random_string.policy_suffix.result}"
  description = "Policy to access ${var.app_name} OAuth and Auth0 secrets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.oauth_credentials.arn,
          aws_secretsmanager_secret.auth0_credentials.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}