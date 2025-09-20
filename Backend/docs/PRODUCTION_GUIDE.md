# VibeSheets Production Guide

## Overview

This guide provides comprehensive instructions for deploying, monitoring, and maintaining VibeSheets in production environments.

## Table of Contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Deployment](#deployment)
4. [Monitoring](#monitoring)
5. [Security](#security)
6. [Troubleshooting](#troubleshooting)
7. [Maintenance](#maintenance)
8. [Disaster Recovery](#disaster-recovery)

## Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CloudFront    │    │   Application   │    │   API Gateway   │
│     (CDN)       │───▶│     Server      │───▶│   + Lambda      │
│                 │    │   (Express)     │    │   Functions     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Monitoring    │    │   DynamoDB      │
                       │   & Logging     │    │   Database      │
                       └─────────────────┘    └─────────────────┘
```

### Technology Stack

- **Frontend**: Static HTML/CSS/JavaScript with Auth0 authentication
- **Backend**: AWS Lambda functions (Node.js)
- **Database**: Amazon DynamoDB
- **CDN**: Amazon CloudFront
- **Monitoring**: Custom logging + health checks
- **Security**: Helmet.js, CORS, rate limiting
- **Infrastructure**: Terraform

## Prerequisites

### Required Tools

- Node.js 18+
- Docker
- AWS CLI v2
- Terraform 1.0+
- kubectl (if using Kubernetes)

### AWS Permissions

Ensure your AWS credentials have the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:*",
        "dynamodb:*",
        "apigateway:*",
        "cloudfront:*",
        "s3:*",
        "iam:*",
        "secretsmanager:*"
      ],
      "Resource": "*"
    }
  ]
}
```

### Environment Variables

Set these environment variables:

```bash
export AWS_REGION=us-east-1
export NODE_ENV=production
export SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

## Deployment

### Quick Start

1. **Clone and setup**:
   ```bash
   git clone https://github.com/vibesheets/vibesheets.git
   cd vibesheets
   npm install
   ```

2. **Deploy to staging**:
   ```bash
   ./deploy.sh --environment staging
   ```

3. **Deploy to production**:
   ```bash
   ./deploy.sh --environment production --version v1.0.0
   ```

### Manual Deployment Steps

#### 1. Build Docker Image

```bash
docker build -t vibesheets:latest .
docker tag vibesheets:latest ghcr.io/vibesheets/vibesheets:latest
docker push ghcr.io/vibesheets/vibesheets:latest
```

#### 2. Deploy Infrastructure

```bash
cd Terraform
terraform init
terraform plan -var="environment=production"
terraform apply
```

#### 3. Update Lambda Functions

```bash
# Package and deploy each Lambda function
cd Terraform/lambda_functions
zip -r ../auth_config.zip auth_config.py
zip -r ../clock_in_out.zip clock_in_out.py
# ... etc for all functions

# Update via AWS CLI
aws lambda update-function-code \
  --function-name vibesheets-auth-config-prod \
  --zip-file fileb://auth_config.zip
```

#### 4. Deploy Frontend

```bash
# Sync to S3
aws s3 sync Frontend/ s3://vibesheets-frontend-prod/

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E1234567890 \
  --paths "/*"
```

### Deployment Verification

After deployment, verify:

1. **Health endpoints**:
   ```bash
   curl https://vibesheets.com/health
   curl https://api.vibesheets.com/auth
   ```

2. **Frontend functionality**:
   - Login page loads
   - Authentication works
   - Dashboard displays correctly

3. **API endpoints**:
   ```bash
   # Test with valid JWT token
   curl -H "Authorization: Bearer $JWT_TOKEN" \
        https://api.vibesheets.com/timesheets
   ```

## Monitoring

### Health Checks

Automated health checks run every 60 seconds:

```bash
# Start health monitoring
node monitoring/health-check.js
```

### Performance Monitoring

```bash
# Start performance monitoring
node monitoring/performance-monitor.js
```

### Metrics Dashboard

Key metrics to monitor:

- **Response Time**: < 2 seconds average
- **Error Rate**: < 1%
- **Uptime**: > 99.9%
- **Memory Usage**: < 80%
- **Database Response Time**: < 500ms

### Alerting

Alerts are triggered for:

- 3+ consecutive health check failures
- Error rate > 5%
- Response time > 5 seconds
- Memory usage > 85%

### Log Locations

- **Application Logs**: `/app/logs/`
- **Access Logs**: CloudFront access logs
- **Lambda Logs**: CloudWatch Logs
- **Error Logs**: Custom logging system

## Security

### Security Headers

The following security headers are automatically applied:

```
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### Rate Limiting

- **Global**: 100 requests per 15 minutes per IP
- **API**: 30 requests per minute per endpoint per user
- **Login**: 5 attempts per 15 minutes per IP

### Authentication

- **JWT tokens** expire in 1 hour
- **Refresh tokens** not implemented (users must re-authenticate)
- **Auth0** handles password policies and MFA

### SSL/TLS

- **TLS 1.2+** required
- **HSTS** enabled
- **Certificate auto-renewal** via AWS Certificate Manager

## Troubleshooting

### Common Issues

#### 1. Authentication Failures

**Symptoms**: Users can't log in, 401 errors

**Causes**:
- Expired JWT tokens
- Auth0 configuration issues
- Network connectivity

**Solutions**:
```bash
# Check Auth0 configuration
curl https://api.vibesheets.com/auth

# Verify JWT token format
node -e "console.log(JSON.parse(Buffer.from('$JWT_PAYLOAD', 'base64')))"

# Check Auth0 logs
# Visit Auth0 dashboard > Logs
```

#### 2. Database Connection Issues

**Symptoms**: 500 errors, timeout errors

**Causes**:
- DynamoDB throttling
- Network issues
- IAM permission problems

**Solutions**:
```bash
# Check DynamoDB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=time_entries

# Test DynamoDB connectivity
aws dynamodb describe-table --table-name time_entries
```

#### 3. High Memory Usage

**Symptoms**: Application restarts, slow performance

**Causes**:
- Memory leaks
- Large payloads
- Inefficient queries

**Solutions**:
```bash
# Check memory usage
docker stats vibesheets-app

# Analyze heap dumps
node --inspect production-server.js
```

### Debugging Commands

```bash
# Check application status
curl -f https://vibesheets.com/health

# View recent logs
tail -f logs/app.log

# Check Docker container
docker logs vibesheets-app

# Monitor performance
node monitoring/performance-monitor.js

# Export logs for analysis
node -e "require('./Frontend/js/logger.js').logger.exportLogs()"
```

### Performance Optimization

#### Database Optimization

```bash
# Check DynamoDB performance
aws dynamodb describe-table --table-name time_entries

# Analyze slow queries
# Review CloudWatch metrics for read/write throttling
```

#### CDN Optimization

```bash
# Check CloudFront cache hit ratio
aws cloudfront get-distribution-config --id E1234567890

# Invalidate cache if needed
aws cloudfront create-invalidation \
  --distribution-id E1234567890 \
  --paths "/js/*" "/css/*"
```

## Maintenance

### Regular Tasks

#### Daily
- [ ] Check health monitoring alerts
- [ ] Review error logs
- [ ] Monitor performance metrics

#### Weekly
- [ ] Security scan with `npm audit`
- [ ] Update dependencies if needed
- [ ] Review access logs for anomalies
- [ ] Check SSL certificate expiry

#### Monthly
- [ ] Full backup verification
- [ ] Performance testing
- [ ] Security assessment
- [ ] Capacity planning review

### Updates and Patches

#### Security Updates

```bash
# Check for vulnerabilities
npm audit

# Update dependencies
npm update

# Rebuild and redeploy
./deploy.sh --environment production
```

#### Feature Updates

1. **Deploy to staging first**:
   ```bash
   ./deploy.sh --environment staging --version v1.1.0
   ```

2. **Run tests**:
   ```bash
   npm test
   npm run test:e2e
   ```

3. **Deploy to production**:
   ```bash
   ./deploy.sh --environment production --version v1.1.0
   ```

### Backup Procedures

#### Database Backup

```bash
# Enable point-in-time recovery
aws dynamodb put-backup-policy \
  --table-name time_entries \
  --backup-policy PointInTimeRecoveryEnabled=true

# Create manual backup
aws dynamodb create-backup \
  --table-name time_entries \
  --backup-name time_entries_$(date +%Y%m%d)
```

#### Code Backup

- Git repository serves as primary backup
- Docker images stored in container registry
- Terraform state stored in S3 with versioning

## Disaster Recovery

### Recovery Time Objectives (RTO)

- **Critical**: 1 hour
- **High**: 4 hours
- **Medium**: 24 hours

### Recovery Point Objectives (RPO)

- **Database**: 1 hour (point-in-time recovery)
- **Files**: Real-time (S3 replication)

### Disaster Scenarios

#### 1. Application Server Failure

**Detection**: Health checks fail, 5xx errors

**Response**:
```bash
# Check server status
docker ps
systemctl status docker

# Restart application
docker-compose restart

# Or redeploy
./deploy.sh --environment production --force
```

#### 2. Database Failure

**Detection**: Database connection errors

**Response**:
```bash
# Check DynamoDB status
aws dynamodb describe-table --table-name time_entries

# Restore from backup if needed
aws dynamodb restore-table-from-backup \
  --target-table-name time_entries_restored \
  --backup-arn arn:aws:dynamodb:...
```

#### 3. CDN/DNS Failure

**Detection**: Website unreachable

**Response**:
```bash
# Check CloudFront status
aws cloudfront get-distribution --id E1234567890

# Check Route53 health checks
aws route53 get-health-check --health-check-id abc123

# Failover to backup region if configured
```

### Communication Plan

During incidents:

1. **Notify stakeholders** via Slack/email
2. **Update status page** if available
3. **Document actions taken**
4. **Conduct post-incident review**

### Contact Information

- **On-call Engineer**: [Slack @oncall]
- **AWS Support**: [Support case system]
- **Auth0 Support**: [Auth0 dashboard]

## Scaling

### Horizontal Scaling

```bash
# Scale ECS service
aws ecs update-service \
  --cluster vibesheets-cluster \
  --service vibesheets-service \
  --desired-count 3

# Scale Lambda concurrency
aws lambda put-concurrency \
  --function-name vibesheets-clock-in-out-prod \
  --reserved-concurrent-executions 100
```

### Database Scaling

```bash
# Increase DynamoDB capacity
aws dynamodb update-table \
  --table-name time_entries \
  --provisioned-throughput ReadCapacityUnits=20,WriteCapacityUnits=20
```

### Performance Thresholds

Scale when:
- CPU > 70% for 5+ minutes
- Memory > 80% for 5+ minutes
- Response time > 3 seconds average
- Error rate > 2%

## Cost Optimization

### Monitoring Costs

```bash
# Check AWS costs
aws ce get-cost-and-usage \
  --time-period Start=2023-01-01,End=2023-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

### Optimization Strategies

- Use DynamoDB On-Demand for variable workloads
- Enable S3 Intelligent Tiering
- Use CloudFront caching aggressively
- Right-size Lambda memory allocations
- Clean up old CloudWatch logs

---

For additional support, contact the development team or refer to the troubleshooting section.