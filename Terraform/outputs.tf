# ===== OUTPUTS =====

# Website and Infrastructure
output "website_url" {
  description = "Website URL"
  value       = "https://${var.app_domain}"
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.app_bucket.id
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.app_distribution.id
}

# DNS Configuration
output "route53_name_servers" {
  description = "Route53 name servers for the domain - configure these with your domain registrar"
  value       = aws_route53_zone.main.name_servers
}

# API URLs
output "auth_api_url" {
  description = "URL of the auth configuration API"
  value       = "https://api.${var.app_domain}/config"
}

output "timesheet_api_url" {
  description = "URL of the timesheet API"
  value       = "https://api.${var.app_domain}"
}

output "timesheet_api_invoke_url" {
  description = "Direct invoke URL of the timesheet API (for development/testing)"
  value       = "https://${aws_api_gateway_rest_api.timesheet_api.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_api_gateway_stage.timesheet_api_stage.stage_name}"
}

# Database
output "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  value       = aws_dynamodb_table.timesheet_table.name
}

# Secrets (for reference)
output "auth0_secret_name" {
  description = "Name of the Auth0 secrets in AWS Secrets Manager"
  value       = aws_secretsmanager_secret.auth0_credentials.name
}

output "oauth_secret_name" {
  description = "Name of the OAuth secrets in AWS Secrets Manager"
  value       = aws_secretsmanager_secret.oauth_credentials.name
}

# Deployment Instructions
output "deployment_instructions" {
  description = "Next steps for deployment"
  value = <<-EOT
    
    ✅ Infrastructure deployed successfully!
    
    📋 Next Steps:
    1. Configure secrets in AWS Secrets Manager:
       - ${aws_secretsmanager_secret.auth0_credentials.name}
       - ${aws_secretsmanager_secret.oauth_credentials.name}
    
    2. Upload frontend files:
       aws s3 sync Frontend/ s3://${aws_s3_bucket.app_bucket.id}/
    
    3. Configure DNS:
       Update your domain registrar with these name servers:
       ${join(", ", aws_route53_zone.main.name_servers)}
    
    4. Update frontend config (for development):
       localStorage.setItem('timesheet_api_url', '${aws_api_gateway_rest_api.timesheet_api.id}.execute-api.${var.aws_region}.amazonaws.com/prod');
    
    🌐 Your app will be available at: https://${var.app_domain}
  EOT
}