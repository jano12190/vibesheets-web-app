# Terraform Variables for VibeSheets Infrastructure

variable "app_domain" {
  description = "Application domain"
  type        = string
  default     = "vibesheets.com"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "vibesheets"
}

# Tags to apply to all resources
variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Application = "Vibesheets"
    Environment = "production"
    ManagedBy   = "Terraform"
  }
}