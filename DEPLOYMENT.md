# VibeSheets Deployment Guide

## Prerequisites

1. AWS CLI configured with appropriate permissions
2. Terraform installed (v1.0+)
3. Domain name for production deployment

## Step 1: Configure Secrets

Before deploying, you need to manually create the secrets in AWS Secrets Manager:

### Auth0 Credentials
```bash
aws secretsmanager create-secret \
    --name "vibesheets/auth0-credentials" \
    --description "Auth0 credentials for Vibesheets" \
    --secret-string '{
        "auth0_domain": "your-auth0-domain.auth0.com",
        "auth0_client_id": "your-auth0-client-id",
        "auth0_audience": "your-auth0-api-audience"
    }'
```

### OAuth Credentials  
```bash
aws secretsmanager create-secret \
    --name "vibesheets/oauth-credentials" \
    --description "OAuth credentials for Vibesheets" \
    --secret-string '{
        "google_client_id": "your-google-client-id"
    }'
```

## Step 2: Deploy Infrastructure

```bash
cd Terraform/

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Deploy
terraform apply
```

## Step 3: Note the API URLs

After deployment, Terraform will output the API Gateway URLs:

- `timesheet_api_invoke_url` - Use this for the timesheet API
- `auth_api_url` - Already configured for auth

## Step 4: Update Frontend Configuration

For development/testing, update the API URLs in localStorage:

```javascript
localStorage.setItem('timesheet_api_url', 'https://YOUR_NEW_API_ID.execute-api.us-east-1.amazonaws.com/prod');
localStorage.setItem('auth_api_url', 'https://YOUR_AUTH_API_ID.execute-api.us-east-1.amazonaws.com/prod/config');
```

Or for production, the URLs will be auto-detected from the domain.

## Step 5: Upload Frontend Files

```bash
# Sync frontend files to S3
aws s3 sync Frontend/ s3://YOUR_BUCKET_NAME/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

## Step 6: Configure DNS (Production Only)

If using a custom domain, configure your DNS to point to the Route53 name servers output by Terraform.

## Testing

1. Navigate to your deployed site
2. Test authentication with Auth0
3. Test clock in/out functionality
4. Test timesheet export

## Troubleshooting

### Common Issues:

1. **401 Errors**: Check Auth0 configuration and secrets
2. **CORS Errors**: Verify frontend domain matches CORS settings
3. **Lambda Timeouts**: Check CloudWatch logs for specific errors
4. **API Gateway 5xx**: Check Lambda function logs in CloudWatch

### Useful Commands:

```bash
# Check Lambda logs
aws logs tail /aws/lambda/vibesheets-clock-in-out --follow

# Test API endpoint directly
curl -X POST https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod/clock-in \
  -H "Content-Type: application/json" \
  -d '{"userId": "test"}'
```