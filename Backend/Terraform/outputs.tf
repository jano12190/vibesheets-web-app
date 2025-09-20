output "website_url" {
  description = "URL of the website"
  value       = "https://${var.domain_name}"
}

output "api_url" {
  description = "URL of the API"
  value       = "https://api.${var.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "CloudFront Distribution ID"
  value       = aws_cloudfront_distribution.frontend.id
}

output "s3_bucket_name" {
  description = "S3 bucket name for frontend"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_bucket_name" {
  description = "Frontend S3 bucket name for GitHub Actions"
  value       = aws_s3_bucket.frontend.bucket
}

output "api_gateway_id" {
  description = "API Gateway ID"
  value       = aws_api_gateway_rest_api.api.id
}

output "dynamodb_table_names" {
  description = "DynamoDB table names"
  value = {
    time_entries   = aws_dynamodb_table.time_entries.name
    user_settings  = aws_dynamodb_table.user_settings.name
    user_sessions  = aws_dynamodb_table.user_sessions.name
  }
}

output "lambda_function_names" {
  description = "Lambda function names"
  value = {
    auth_config      = aws_lambda_function.auth_config.function_name
    clock_in_out     = aws_lambda_function.clock_in_out.function_name
    clock_status     = aws_lambda_function.clock_status.function_name
    get_timesheets   = aws_lambda_function.get_timesheets.function_name
    update_timesheet = aws_lambda_function.update_timesheet.function_name
    export_timesheet = aws_lambda_function.export_timesheet.function_name
  }
}

output "nameservers" {
  description = "Route53 hosted zone nameservers - configure these with your domain registrar"
  value       = aws_route53_zone.main.name_servers
}

output "hosted_zone_id" {
  description = "Route53 hosted zone ID"
  value       = aws_route53_zone.main.zone_id
}