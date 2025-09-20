# AWS Secrets Manager for sensitive configuration
resource "aws_secretsmanager_secret" "auth_config" {
  name        = "${var.project_name}-auth-config-${var.environment}"
  description = "Authentication configuration for VibeSheets"
  
  # Create empty secret that will be populated manually after deployment
  recovery_window_in_days = 7
}

# Stripe payment configuration
resource "aws_secretsmanager_secret" "stripe_config" {
  name        = "${var.project_name}-stripe-config-${var.environment}"
  description = "Stripe payment configuration for VibeSheets"
  
  recovery_window_in_days = 7
}

# Note: The secret values should be set manually after deployment using AWS CLI:
# 
# Auth0/Google configuration:
# aws secretsmanager put-secret-value \
#   --secret-id vibesheets-auth-config-prod \
#   --secret-string '{
#     "auth0_domain": "your-domain.auth0.com",
#     "auth0_client_id": "your-client-id", 
#     "auth0_client_secret": "your-client-secret",
#     "google_client_id": "your-google-client-id",
#     "google_client_secret": "your-google-client-secret"
#   }'
#
# Stripe configuration:
# aws secretsmanager put-secret-value \
#   --secret-id vibesheets-stripe-config-prod \
#   --secret-string '{
#     "stripe_public_key": "pk_live_...",
#     "stripe_secret_key": "sk_live_...",
#     "stripe_webhook_secret": "whsec_..."
#   }'