# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VibeSheets is a timesheet web application for tracking work hours with the following components:

- **Frontend**: Static HTML/CSS/JS web application with Auth0 authentication
- **Backend**: AWS Lambda functions (serverless architecture)  
- **Infrastructure**: AWS resources managed via Terraform
- **Domain**: vibesheets.com (already purchased)

## Architecture

### Frontend Structure
- `Frontend/index.html` - Login page with Auth0 and Google authentication
- `Frontend/dashboard.html` - Main timesheet dashboard with clock in/out functionality
- `Frontend/assets/css/` - Styling (login.css, style.css, dashboard.css)
- `Frontend/assets/js/` - JavaScript files for authentication and dashboard functionality
  - `auth.js` - Authentication logic, login/logout, session management
  - `dashboard.js` - Dashboard functionality, clock in/out, time tracking, data display

### Backend Structure
- **Lambda Functions** (in `Terraform/lambda_functions/`):
  - `auth_config.py` - Returns public Auth0/Google OAuth configuration
  - `clock_in_out.py` - Handles time clock operations with JWT verification
  - `clock_status.py` - Returns current user session status
  - `get_timesheets.py` - Retrieves timesheet data with date filtering
  - `update_timesheet.py` - Updates existing time entries
  - `export_timesheet.py` - Exports timesheets to CSV format
- **DynamoDB Tables**:
  - `time_entries` - Stores clock in/out records with date indexing
  - `user_sessions` - Tracks active session status (clocked in/out)
  - `user_settings` - User preferences and configuration
- **API Gateway**: REST API with CORS-enabled endpoints at api.vibesheets.com

### Infrastructure
- `Terraform/` directory contains AWS infrastructure as code
- Hosted on AWS with CloudFront distribution
- Route53 DNS management for vibesheets.com domain
- SSL certificates managed via ACM with DNS validation

## Development Workflow

### Infrastructure Commands
```bash
cd Terraform

# Initialize Terraform (first time only)
terraform init

# Plan changes
terraform plan

# Apply infrastructure changes
terraform apply

# Destroy infrastructure (careful!)
terraform destroy
```

### Configuration Setup
1. Copy `terraform.tfvars.example` to `terraform.tfvars`
2. Update variables as needed
3. After deployment, set Auth0/Google secrets:
```bash
aws secretsmanager put-secret-value \
  --secret-id vibesheets-auth-config-prod \
  --secret-string '{
    "auth0_domain": "your-domain.auth0.com",
    "auth0_client_id": "your-client-id", 
    "auth0_client_secret": "your-client-secret",
    "google_client_id": "your-google-client-id",
    "google_client_secret": "your-google-client-secret"
  }'
```

### Lambda Development
- Lambda functions automatically packaged as ZIP files during terraform apply
- Function code in `Terraform/lambda_functions/` gets deployed to AWS Lambda
- All functions use Python 3.11 runtime with 30-second timeout
- Environment variables configured via Terraform for database and secret access

### Frontend Development
- Static files served via S3 + CloudFront
- No build process required - direct HTML/CSS/JS
- Frontend calls API at api.vibesheets.com for backend integration
- **JavaScript Functions Required**: HTML files call functions like `handleGoogleLogin()`, `handleAuth0Login()`, `clockIn()`, `clockOut()`, `exportPDF()`, etc.
- **Frontend Deployment**: Changes to Frontend/ directory require S3 sync and CloudFront invalidation via Terraform or CI/CD

## API Endpoints
- `GET /auth` - Retrieve Auth0/Google configuration
- `POST /clock` - Clock in/out operations (requires JWT token)
- `GET /status` - Get current clock status (requires JWT token)
- `GET /timesheets` - Retrieve timesheet data (requires JWT token)
- `PUT /timesheets` - Update timesheet entries (requires JWT token)
- `DELETE /timesheets` - Delete timesheet entries (requires JWT token)
- `POST /export` - Export timesheets to PDF/CSV (requires JWT token)

## Database Schema
- **time_entries**: `user_id` (hash), `timestamp` (range), `date`, `type`, `hours`
- **user_sessions**: `user_id` (hash), `status`, `clock_in_time`, `last_updated`
- **user_settings**: `user_id` (hash), user preference data

## Key Features
- User authentication via Auth0 (email/password and Google OAuth)
- Clock in/out functionality with automatic hour calculation
- Monthly hours tracking with date-based queries
- Time entry editing and management
- CSV export of timesheets
- Period-based filtering (daily, weekly, monthly, custom ranges)
- Session state management for clock status tracking

## Security Configuration
- JWT tokens validated in Lambda functions (simplified verification)
- Secrets stored in AWS Secrets Manager
- CORS configured for cross-origin requests
- IAM roles limit Lambda permissions to required resources only

## Deployment Notes
- Frontend deployed to S3 with CloudFront distribution
- Backend functions deployed as Lambda functions
- Infrastructure managed entirely through Terraform
- Domain already configured: vibesheets.com
- SSL certificates auto-renewed via ACM

## Recent Fixes (2025-07-02)
- ✅ **Fixed missing hoursLabel element**: Added `id="hoursLabel"` to h2 in dashboard.html
- ✅ **Fixed Frontend git submodule**: Committed changes properly to submodule
- ✅ **Fixed timezone handling**: Updated JavaScript to use UTC consistently with backend
- ✅ **Improved session cleanup**: Added logic to recover from stale clock-in states
- ✅ **Fixed API Gateway routing**: Added DELETE method support for /timesheets endpoint
- ✅ **Updated documentation**: Corrected outdated information about JavaScript files

## Known Working Features
- User authentication via Auth0 and Google OAuth
- Clock in/out functionality with session tracking
- Time entry viewing, editing, and deletion
- Hours calculation and period filtering
- PDF/CSV export of timesheets
- Responsive mobile design