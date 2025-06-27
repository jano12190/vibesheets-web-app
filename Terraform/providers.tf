# Terraform Providers Configuration

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
  }
  
  required_version = ">= 1.0"
}

# Configure AWS provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.common_tags
  }
}