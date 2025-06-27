# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VibeSheets is a cloud-based timesheet application with a serverless architecture consisting of:

- **Frontend**: Static HTML/CSS/JavaScript web application hosted on AWS S3 with CloudFront
- **Backend**: Python AWS Lambda functions for API endpoints
- **Infrastructure**: Terraform configuration for AWS resources (S3, Lambda, API Gateway, DynamoDB, etc.)

## Architecture Components

### Frontend (`/Frontend/`)
- Pure JavaScript application (no framework)
- Uses Auth0 for authentication
- Communicates with Lambda functions via API Gateway
- Key files:
  - `dashboard.html` - Main timesheet interface
  - `index.html` - Login page
  - `assets/js/dashboard.js` - Core dashboard functionality
  - `assets/js/login.js` - Authentication handling

### Backend (`/Backend/`)
- AWS Lambda functions written in Python
- DynamoDB for data storage
- Key functions:
  - `auth_config.py` - Serves Auth0 configuration from AWS Secrets Manager
  - `clock_in_out.py` - Handles time tracking (clock in/out operations)
  - `get_timesheets.py` - Retrieves timesheet data with filtering
  - `update_timesheet.py` - Modifies existing timesheet entries
  - `export_timesheet.py` - Exports timesheet data to various formats

### Infrastructure (`/Terraform/`)
- Complete AWS infrastructure as code
- Includes S3, CloudFront, Lambda, API Gateway, DynamoDB, Route53, ACM certificates
- Secrets Manager for Auth0 and OAuth credentials

## Development Commands

Since this is a serverless application without a traditional build system:

### Frontend Development
- No build step required - static files served directly
- Test locally by opening HTML files in browser
- For production: sync files to S3 bucket

### Backend Development
- Lambda functions deployed via Terraform or AWS CLI
- Test locally using AWS SAM or direct Python execution
- Requirements: `boto3` (included in Lambda runtime)

### Infrastructure Management
```bash
# Deploy infrastructure
cd Terraform/
terraform init
terraform plan
terraform apply

# Destroy infrastructure
terraform destroy
```

## Key Configuration

### Authentication
- Uses Auth0 for user authentication
- Credentials stored in AWS Secrets Manager
- Configuration served via `auth_config.py` Lambda function

### Data Storage
- DynamoDB with composite keys (PK/SK pattern)
- GSI for date-based queries
- Schema supports user isolation and time entry tracking

### API Structure
- RESTful API via AWS API Gateway
- CORS enabled for cross-origin requests
- Lambda proxy integration

## Environment Variables (Lambda)
- `DYNAMODB_TABLE` - DynamoDB table name for timesheet data
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
- `AWS_REGION` - AWS region (defaults to us-east-1)

## Important Notes
- No package.json or traditional dependency management
- Frontend uses vanilla JavaScript (no build tools)
- All AWS resources managed through Terraform
- Production deployment requires manual S3 sync for frontend files
- Secrets must be manually configured in AWS Secrets Manager before deployment