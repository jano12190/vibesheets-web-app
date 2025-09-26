# Use existing auth config secret or create new one
data "aws_secretsmanager_secret" "auth_config_existing" {
  count = var.existing_auth_secret_name != "" ? 1 : 0
  name  = var.existing_auth_secret_name
}

resource "aws_secretsmanager_secret" "auth_config" {
  count       = var.existing_auth_secret_name == "" ? 1 : 0
  name        = "${var.project_name}-auth-config-${var.environment}"
  description = "Authentication configuration for VibeSheets"
  
  recovery_window_in_days = 7
}

# Use existing MongoDB config secret or create new one
data "aws_secretsmanager_secret" "mongodb_config_existing" {
  count = var.existing_mongodb_secret_name != "" ? 1 : 0
  name  = var.existing_mongodb_secret_name
}

resource "aws_secretsmanager_secret" "mongodb_config" {
  count       = var.existing_mongodb_secret_name == "" ? 1 : 0
  name        = "${var.project_name}-mongodb-config-${var.environment}"
  description = "MongoDB Atlas configuration for VibeSheets"
  
  recovery_window_in_days = 7
}

# Local values to determine which secrets to use
locals {
  auth_secret_arn    = var.existing_auth_secret_name != "" ? data.aws_secretsmanager_secret.auth_config_existing[0].arn : aws_secretsmanager_secret.auth_config[0].arn
  mongodb_secret_arn = var.existing_mongodb_secret_name != "" ? data.aws_secretsmanager_secret.mongodb_config_existing[0].arn : aws_secretsmanager_secret.mongodb_config[0].arn
}


# Note: If using existing secrets, make sure they contain:
# 
# Auth config secret should contain:
# {
#   "auth0_domain": "your-domain.auth0.com",
#   "auth0_client_id": "your-client-id",
#   "auth0_client_secret": "your-client-secret",
#   "auth0_audience": "https://api.vibesheets.com",
#   "google_client_id": "your-google-client-id",
#   "google_client_secret": "your-google-client-secret"
# }
#
# MongoDB config secret should contain:
# {
#   "mongodb_uri": "mongodb+srv://...",
#   "mongodb_database": "vibesheets"
# }