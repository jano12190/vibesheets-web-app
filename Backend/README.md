# VibeSheets Backend

Serverless backend API for the VibeSheets timesheet application built with AWS Lambda and DynamoDB.

## Architecture

- **AWS Lambda** - Python 3.11 serverless functions
- **DynamoDB** - NoSQL database for time entries and user sessions
- **API Gateway** - REST API with custom domain (api.vibesheets.com)
- **Terraform** - Infrastructure as Code

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /auth | Authentication configuration |
| POST | /clock | Clock in/out operations |
| GET | /status | Current session status |
| GET | /timesheets | Retrieve timesheet data |
| PUT | /timesheets | Update time entries |
| DELETE | /timesheets | Delete time entries |
| POST | /export | Export to CSV format |

## Lambda Functions

- **auth_config.py** - Auth0/Google OAuth configuration
- **clock_in_out.py** - Time tracking with JWT validation
- **clock_status.py** - Session status management
- **get_timesheets.py** - Timesheet data retrieval
- **update_timesheet.py** - Time entry modifications
- **export_timesheet.py** - CSV export functionality

## Security Features

- JWT token validation on protected endpoints
- Auth0 integration with Google OAuth
- AWS Secrets Manager for sensitive data
- CORS configuration for cross-origin requests
- IAM roles with least privilege access

## Infrastructure Deployment

```bash
cd Terraform
terraform init
terraform plan
terraform apply
```

## Database Schema

- **time_entries** - User time records with date indexing
- **user_sessions** - Active session status tracking
- **user_settings** - User preferences and configuration