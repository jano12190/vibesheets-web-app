# VibeSheets

A professional timesheet tracking application built with modern serverless architecture.

## Overview

VibeSheets is a web-based time tracking solution that allows users to clock in/out, manage timesheets, and export data. The application demonstrates proficiency in modern web development, cloud infrastructure, and security best practices.

**Live Application**: https://vibesheets.com

## Technical Stack

**Frontend**
- HTML5, CSS3, JavaScript ES6+
- Progressive Web App features
- Responsive design for mobile and desktop

**Backend**
- AWS Lambda functions (Python 3.11)
- Amazon DynamoDB (NoSQL database)
- AWS API Gateway (REST API)

**Infrastructure**
- AWS S3 + CloudFront for static hosting
- Route53 for DNS management
- SSL certificates via AWS Certificate Manager
- Infrastructure as Code using Terraform

**Authentication**
- Auth0 integration with Google OAuth
- JWT-based API security

## Key Features

- Secure user authentication (Auth0 + Google OAuth)
- Time clock functionality with automatic duration calculation
- Timesheet viewing, editing, and deletion
- Data export to CSV format
- Period-based filtering (daily, weekly, monthly, custom ranges)
- Responsive mobile-first design

## Architecture

The application follows a serverless architecture pattern:

- **Frontend**: Static files served via CloudFront CDN
- **API**: AWS Lambda functions behind API Gateway
- **Database**: DynamoDB tables for time entries, user sessions, and settings
- **Security**: JWT authentication, CORS protection, input validation

## Database Schema

**time_entries**: User time tracking records with date indexing
**user_sessions**: Active session status management
**user_settings**: User preferences and configuration

## API Endpoints

- `GET /auth` - Authentication configuration
- `POST /clock` - Clock in/out operations
- `GET /status` - Current session status
- `GET /timesheets` - Retrieve timesheet data
- `PUT /timesheets` - Update time entries
- `POST /export` - Export data to CSV

## Security Implementation

- JWT token validation for all protected endpoints
- Input sanitization and validation
- CORS protection with strict origin controls
- Secrets management via AWS Secrets Manager
- Rate limiting and XSS protection

## Development Workflow

**Infrastructure Deployment**
```bash
cd Terraform
terraform init
terraform plan
terraform apply
```

**Local Development**
- Frontend files can be served directly from the file system
- Backend requires AWS credentials for Lambda function development
- All configuration managed through environment variables

## Performance & Monitoring

- Page load times under 2 seconds
- API response times under 500ms average
- Comprehensive error logging and monitoring
- SSL/TLS encryption for all communications

## Project Highlights

This project demonstrates:
- Modern serverless application architecture
- Secure authentication and authorization patterns
- Responsive web design principles
- Infrastructure as Code practices
- Production deployment and monitoring

The application serves as a practical example of building scalable, secure web applications using cloud-native technologies and modern development practices.