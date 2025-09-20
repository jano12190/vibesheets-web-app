# Backend Deployment Guide

This guide explains how to deploy the AWS Lambda backend infrastructure for VibeSheets.

## Prerequisites

1. **AWS CLI configured** with appropriate credentials
2. **Terraform installed** (v1.0 or later)
3. **Domain ownership** of vibesheets.com
4. **Auth0 account** with application configured

## Deployment Steps

### 1. Configure Terraform Variables

```bash
cd Backend/Terraform
cp terraform.tfvars.example terraform.tfvars
```

Update `terraform.tfvars` with your values:
```hcl
domain_name = "vibesheets.com"
project_name = "vibesheets"
environment = "prod"
```

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Deploy Infrastructure

```bash
terraform plan
terraform apply
```

This will create:
- **DynamoDB Tables**: `projects`, `time_entries`, `user_sessions`, `user_settings`
- **Lambda Functions**: Project CRUD operations, authentication, timesheets
- **API Gateway**: REST API at `api.vibesheets.com`
- **Route53 & ACM**: SSL certificates and DNS

### 4. Configure Auth0 Secrets

After deployment, update the Auth0 configuration:

```bash
aws secretsmanager put-secret-value \
  --secret-id vibesheets-auth-config-prod \
  --secret-string '{
    "auth0_domain": "your-domain.auth0.com",
    "auth0_client_id": "your-client-id", 
    "auth0_client_secret": "your-client-secret"
  }'
```

## API Endpoints

The following endpoints will be available at `https://api.vibesheets.com/prod/`:

### Projects API
- `GET /projects` - Get all projects (with optional `?status=active|archived`)
- `POST /projects` - Create new project
- `PUT /projects/{id}` - Update project
- `DELETE /projects/{id}` - Delete project

### Authentication
- `GET /auth` - Get Auth0 configuration

### Timesheets (Existing)
- `POST /clock` - Clock in/out
- `GET /status` - Get clock status
- `GET /timesheets` - Get timesheet data
- `PUT /timesheets` - Update timesheet entries

## Frontend Integration

The React frontend automatically detects the environment:

- **Development**: Uses localStorage for data (no backend required)
- **Production**: Uses real API endpoints at `api.vibesheets.com`

To deploy the frontend for production, build it with:

```bash
npm run build
```

Then upload the `dist/` folder to your S3 bucket or hosting provider.

## Security Features

✅ **JWT Authentication**: All endpoints validate Auth0 tokens
✅ **CORS Protection**: Configured for cross-origin requests
✅ **Input Validation**: Server-side validation of all inputs
✅ **Business Logic**: Free tier limitation (one active project)
✅ **Error Handling**: Comprehensive error responses

## Database Schema

### Projects Table
- `user_id` (Hash Key) - User identifier from Auth0
- `project_id` (Range Key) - Unique project UUID
- `name`, `client`, `status`, `rate`, `description`
- `client_email`, `client_address`, `invoice_terms`
- `total_hours`, `this_week`, `created_date`

### Indexes
- `StatusIndex` - Query projects by status
- `CreatedDateIndex` - Query projects by creation date

## Monitoring

Check AWS CloudWatch Logs for:
- Lambda function execution logs
- API Gateway access logs
- Error rates and performance metrics

## Troubleshooting

### Common Issues

1. **Lambda Permission Errors**
   - Verify IAM roles have DynamoDB and Secrets Manager access
   - Check Lambda environment variables

2. **API Gateway CORS Issues**
   - Ensure OPTIONS methods are configured
   - Verify CORS headers in Lambda responses

3. **Auth0 Token Validation**
   - Confirm secrets are properly configured
   - Check Auth0 domain and audience settings

## Cost Estimation

AWS resources for typical usage:
- **Lambda**: ~$5-10/month (first 1M requests free)
- **DynamoDB**: ~$2-5/month (25GB free tier)
- **API Gateway**: ~$3-7/month (first 1M requests free)
- **Route53**: ~$0.50/month per hosted zone

**Total estimated cost**: $10-25/month for moderate usage

## Next Steps

1. Deploy the infrastructure with `terraform apply`
2. Configure Auth0 secrets
3. Test API endpoints with authentication
4. Deploy React frontend to production
5. Set up monitoring and alerts