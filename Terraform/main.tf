# Main Terraform Configuration
# This file includes the main resources and references other module files

# Local values
locals {
  app_name = var.app_name
}

# Include all other configurations via separate files:
# - providers.tf: Terraform providers and requirements
# - variables.tf: Variable definitions
# - secrets.tf: AWS Secrets Manager resources
# - dynamodb.tf: DynamoDB table and policies
# - lambda.tf: Lambda functions and IAM roles
# - api-gateway.tf: API Gateway resources and integrations
# - s3-cloudfront.tf: S3 bucket and CloudFront distribution
# - route53-acm.tf: Route53 zones and SSL certificates
# - outputs.tf: Output values