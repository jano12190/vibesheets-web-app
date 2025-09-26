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

# DynamoDB no longer used - MongoDB Atlas is the database

output "lambda_function_names" {
  description = "Lambda function names"
  value = {
    auth_config      = aws_lambda_function.auth_config_nodejs.function_name
    clock_in_out     = aws_lambda_function.clock_in_out_nodejs.function_name
    clock_status     = aws_lambda_function.clock_status_nodejs.function_name
    get_timesheets   = aws_lambda_function.get_timesheets_nodejs.function_name
    update_timesheet = aws_lambda_function.update_timesheet_nodejs.function_name
    export_timesheet = aws_lambda_function.export_timesheet_nodejs.function_name
    get_projects     = aws_lambda_function.get_projects_nodejs.function_name
    create_project   = aws_lambda_function.create_project_nodejs.function_name
  }
}

output "hosted_zone_id" {
  description = "Route53 hosted zone ID"
  value       = local.zone_id
}