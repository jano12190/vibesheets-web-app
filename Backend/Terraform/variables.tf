variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "vibesheets.com"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "vibesheets"
}

# Auth0 Configuration
variable "auth0_domain" {
  description = "Auth0 domain"
  type        = string
  default     = ""
}

variable "auth0_client_id" {
  description = "Auth0 client ID"
  type        = string
  default     = ""
}

variable "auth0_audience" {
  description = "Auth0 API audience"
  type        = string
  default     = ""
}

variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  default     = ""
}

# MongoDB Configuration (stored in Secrets Manager)
variable "mongodb_database" {
  description = "MongoDB database name (public identifier only)"
  type        = string
  default     = "vibesheets"
}

# Security Configuration
variable "allowed_origins" {
  description = "Comma-separated list of allowed CORS origins"
  type        = string
  default     = ""
}

# Existing AWS Resources (if you want to use existing instead of creating new)
variable "existing_route53_zone_id" {
  description = "Existing Route53 hosted zone ID (leave empty to create new)"
  type        = string
  default     = ""
}

variable "existing_acm_certificate_arn" {
  description = "Existing ACM certificate ARN (leave empty to create new)"
  type        = string
  default     = ""
}

variable "existing_auth_secret_name" {
  description = "Existing Secrets Manager secret name for auth config"
  type        = string
  default     = "vibesheets-auth-config-production"
}

variable "existing_mongodb_secret_name" {
  description = "Existing Secrets Manager secret name for MongoDB config"
  type        = string
  default     = "vibesheets-mongodb-config-prod"
}

# Note: Sensitive variables should be set via terraform.tfvars or environment variables