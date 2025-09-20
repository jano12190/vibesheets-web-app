# VibeSheets Operations Runbook

## Quick Reference

### Emergency Contacts
- **On-call Engineer**: Slack #vibesheets-alerts
- **Product Owner**: [Name] ([email])
- **DevOps Lead**: [Name] ([email])

### Critical URLs
- **Production**: https://vibesheets.com
- **Staging**: https://staging.vibesheets.com
- **API**: https://api.vibesheets.com
- **Status Page**: https://status.vibesheets.com
- **Monitoring**: [Dashboard URL]

### Quick Commands
```bash
# Health check
curl -f https://vibesheets.com/health

# Deploy production
./deploy.sh --environment production

# Rollback production
./deploy.sh --rollback --environment production

# View logs
docker logs vibesheets-app --tail 100

# Start monitoring
node monitoring/health-check.js
```

---

## Incident Response Procedures

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| P0 | Complete service outage | 15 minutes | Site down, database failure |
| P1 | Major functionality broken | 30 minutes | Login broken, data loss |
| P2 | Minor functionality issues | 2 hours | UI bugs, slow performance |
| P3 | Enhancement requests | Next sprint | Feature requests |

### P0 - Critical Incidents

#### Immediate Actions (0-15 minutes)

1. **Acknowledge the alert**
   ```bash
   # Respond in Slack
   !ack "Investigating site outage"
   ```

2. **Assess the scope**
   ```bash
   # Check all services
   curl -f https://vibesheets.com/health
   curl -f https://api.vibesheets.com/auth
   curl -f https://staging.vibesheets.com/health
   ```

3. **Check recent deployments**
   ```bash
   # Check Git history
   git log --oneline -10
   
   # Check Docker containers
   docker ps -a
   ```

4. **Initial triage**
   - Site completely down → Check infrastructure
   - Partial functionality → Check specific services
   - Slow performance → Check resource usage

#### Common P0 Scenarios

##### Site Completely Down

**Symptoms**: 502/503 errors, connection timeouts

**Diagnosis**:
```bash
# Check load balancer
curl -I https://vibesheets.com

# Check Docker status
docker ps
systemctl status docker

# Check resource usage
df -h
free -m
top
```

**Resolution**:
```bash
# Restart application
docker-compose restart

# Or redeploy last known good version
./deploy.sh --rollback --environment production

# Check DNS
nslookup vibesheets.com
```

##### Database Failure

**Symptoms**: 500 errors, timeout messages in logs

**Diagnosis**:
```bash
# Check DynamoDB
aws dynamodb describe-table --table-name time_entries

# Check CloudWatch metrics
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda"
```

**Resolution**:
```bash
# Check table status
aws dynamodb describe-table --table-name time_entries

# Restore from backup if corrupted
aws dynamodb restore-table-from-backup \
  --target-table-name time_entries_restore \
  --backup-arn arn:aws:dynamodb:...

# Update application to use restored table
```

##### Authentication System Down

**Symptoms**: All users get login errors

**Diagnosis**:
```bash
# Test Auth0 endpoint
curl https://api.vibesheets.com/auth

# Check Auth0 dashboard for outages
# Check Auth0 logs for errors
```

**Resolution**:
```bash
# Verify Auth0 configuration
aws secretsmanager get-secret-value \
  --secret-id vibesheets-auth-config-prod

# Restart auth Lambda function
aws lambda update-function-code \
  --function-name vibesheets-auth-config-prod \
  --zip-file fileb://auth_config.zip
```

### P1 - Major Issues

#### Login System Issues

**Symptoms**: Users can't log in, partial authentication failures

**Diagnosis Steps**:
1. Check Auth0 dashboard for errors
2. Verify JWT token validation
3. Check CORS configuration
4. Verify SSL certificate

**Commands**:
```bash
# Test login flow
curl -X POST https://api.vibesheets.com/auth \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Check SSL certificate
openssl s_client -connect vibesheets.com:443 -servername vibesheets.com

# Verify Auth0 configuration
node -e "
const config = require('./Frontend/js/auth.js');
console.log('Auth0 domain:', config.domain);
"
```

#### Data Inconsistency Issues

**Symptoms**: Users see incorrect timesheet data

**Diagnosis**:
```bash
# Check DynamoDB for corrupted records
aws dynamodb scan --table-name time_entries --limit 10

# Check Lambda logs for errors
aws logs filter-log-events \
  --log-group-name "/aws/lambda/vibesheets-get-timesheets-prod" \
  --start-time $(date -d "1 hour ago" +%s)000
```

**Resolution**:
```bash
# Run data validation script
node scripts/validate-data.js

# Fix corrupted records
node scripts/fix-data-inconsistency.js
```

### P2 - Minor Issues

#### Performance Issues

**Symptoms**: Slow page loads, timeouts

**Diagnosis**:
```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://vibesheets.com

# Monitor resource usage
node monitoring/performance-monitor.js

# Check DynamoDB throttling
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ThrottledRequests \
  --dimensions Name=TableName,Value=time_entries \
  --start-time $(date -d "1 hour ago" -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

**Resolution**:
```bash
# Scale up resources
aws ecs update-service \
  --cluster vibesheets-cluster \
  --service vibesheets-service \
  --desired-count 2

# Increase DynamoDB capacity
aws dynamodb update-table \
  --table-name time_entries \
  --provisioned-throughput ReadCapacityUnits=10,WriteCapacityUnits=10
```

---

## Monitoring Procedures

### Health Check Monitoring

**Automated Checks**:
- Every 60 seconds: Frontend health endpoint
- Every 60 seconds: API health endpoint
- Every 300 seconds: End-to-end user flow

**Manual Verification**:
```bash
# Run comprehensive health check
node monitoring/health-check.js

# Check specific endpoint
curl -f https://vibesheets.com/health | jq .

# Test API with authentication
curl -H "Authorization: Bearer $TEST_JWT" \
     https://api.vibesheets.com/timesheets
```

### Performance Monitoring

**Key Metrics to Watch**:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Response Time | > 3s | Investigate performance |
| Error Rate | > 2% | Check logs and fix errors |
| Memory Usage | > 80% | Scale or investigate leaks |
| CPU Usage | > 70% | Scale horizontally |
| Disk Usage | > 85% | Clean up logs |

**Commands**:
```bash
# Real-time performance monitoring
node monitoring/performance-monitor.js

# Check system resources
htop
iotop
netstat -an | grep :3000

# Check Docker stats
docker stats vibesheets-app
```

### Log Analysis

**Important Log Locations**:
- Application: `/app/logs/app.log`
- Access: `/app/logs/access.log`
- Error: `/app/logs/error.log`
- Security: `/app/logs/security.log`

**Useful Log Commands**:
```bash
# Recent errors
tail -f logs/error.log

# Search for specific user issues
grep "user@example.com" logs/app.log

# Count error types
grep "ERROR" logs/app.log | cut -d' ' -f4 | sort | uniq -c

# Performance analysis
grep "SLOW_REQUEST" logs/app.log | tail -20

# Security events
grep "SECURITY" logs/security.log | tail -10
```

---

## Deployment Procedures

### Pre-deployment Checklist

- [ ] All tests passing in CI/CD
- [ ] Security scan completed
- [ ] Staging deployment successful
- [ ] Database migrations tested
- [ ] Rollback plan prepared
- [ ] Stakeholders notified

### Production Deployment

**Standard Deployment**:
```bash
# 1. Deploy to staging first
./deploy.sh --environment staging --version v1.2.3

# 2. Verify staging works
curl -f https://staging.vibesheets.com/health
# Manual testing...

# 3. Deploy to production
./deploy.sh --environment production --version v1.2.3

# 4. Verify production
curl -f https://vibesheets.com/health
```

**Emergency Deployment**:
```bash
# For critical fixes only
./deploy.sh --environment production --version v1.2.4 --force
```

### Post-deployment Verification

**Automated Checks**:
```bash
# Health checks
./deploy.sh --health-check --environment production

# Performance verification
node scripts/performance-test.js
```

**Manual Verification**:
1. Load homepage - should render < 2 seconds
2. Login flow - should complete successfully
3. Dashboard - should load user data
4. Clock in/out - should work without errors
5. Export - should generate CSV file

### Rollback Procedures

**Automatic Rollback Triggers**:
- Health checks fail for 5+ minutes
- Error rate > 10%
- Manual triggering

**Manual Rollback**:
```bash
# Rollback to previous version
./deploy.sh --rollback --environment production

# Verify rollback worked
curl -f https://vibesheets.com/health

# Check application version
curl https://vibesheets.com/health | jq .version
```

---

## Security Procedures

### Security Monitoring

**Daily Checks**:
```bash
# Check for security alerts
grep "SECURITY" logs/security.log | tail -20

# Review failed login attempts
grep "auth_failure" logs/app.log | tail -10

# Check for suspicious patterns
grep -E "(XSS|SQL|injection)" logs/app.log
```

**Weekly Security Audit**:
```bash
# Dependency vulnerability scan
npm audit

# Container security scan
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image vibesheets:latest

# SSL certificate check
openssl s_client -connect vibesheets.com:443 -servername vibesheets.com | \
  openssl x509 -noout -dates
```

### Incident Response

**Security Incident Classification**:

| Level | Description | Response |
|-------|-------------|----------|
| S1 | Data breach, unauthorized access | Immediate lockdown |
| S2 | Vulnerability exploitation | Patch within 4 hours |
| S3 | Suspicious activity | Monitor and investigate |

**S1 Security Incident Response**:

1. **Immediate lockdown**:
   ```bash
   # Disable user access temporarily
   # Update security groups to block traffic
   aws ec2 authorize-security-group-ingress \
     --group-id sg-12345678 \
     --protocol tcp \
     --port 80 \
     --source-group sg-87654321
   ```

2. **Investigate**:
   ```bash
   # Check access logs
   grep -E "40[0-9]|50[0-9]" logs/access.log | tail -50
   
   # Check for data exfiltration
   grep -E "export|download" logs/app.log | tail -20
   
   # Review user activity
   grep "user_id:suspicious_user" logs/app.log
   ```

3. **Notify stakeholders**:
   - Security team
   - Legal team
   - Affected users

---

## Backup and Recovery

### Backup Verification

**Daily Backup Check**:
```bash
# Verify DynamoDB backups
aws dynamodb list-backups --table-name time_entries

# Check backup age
aws dynamodb describe-backup --backup-arn arn:aws:dynamodb:...
```

**Weekly Restore Test**:
```bash
# Test restore process (to temporary table)
aws dynamodb restore-table-from-backup \
  --target-table-name time_entries_test_restore \
  --backup-arn arn:aws:dynamodb:...

# Verify data integrity
node scripts/verify-backup.js time_entries_test_restore

# Cleanup test table
aws dynamodb delete-table --table-name time_entries_test_restore
```

### Recovery Procedures

**Database Recovery**:
```bash
# Point-in-time recovery
aws dynamodb restore-table-to-point-in-time \
  --source-table-name time_entries \
  --target-table-name time_entries_restored \
  --restore-date-time "2023-06-15T10:30:00.000Z"

# Update application configuration
# Update Terraform configuration
# Redeploy application
```

**Application Recovery**:
```bash
# Restore from Git
git checkout v1.2.2

# Rebuild and deploy
./deploy.sh --environment production --version v1.2.2 --force
```

---

## Maintenance Windows

### Scheduled Maintenance

**Monthly Maintenance (First Sunday 2-4 AM UTC)**:

1. **Pre-maintenance**:
   ```bash
   # Notify users
   # Create maintenance page
   # Take backup
   aws dynamodb create-backup \
     --table-name time_entries \
     --backup-name maintenance_$(date +%Y%m%d)
   ```

2. **During maintenance**:
   ```bash
   # Update dependencies
   npm update
   
   # Security patches
   npm audit fix
   
   # Database optimization
   # Performance tuning
   ```

3. **Post-maintenance**:
   ```bash
   # Verify all services
   ./deploy.sh --health-check --environment production
   
   # Performance testing
   node scripts/performance-test.js
   
   # Remove maintenance page
   ```

### Emergency Maintenance

**Unplanned Maintenance Process**:

1. **Assessment** (0-15 min):
   - Determine if maintenance can wait
   - Estimate downtime
   - Identify affected users

2. **Communication** (15-30 min):
   - Post status update
   - Notify stakeholders
   - Set expectations

3. **Execution**:
   - Make necessary changes
   - Test thoroughly
   - Restore service

4. **Post-incident**:
   - Document what happened
   - Update procedures
   - Conduct retrospective

---

## Contact Escalation

### Escalation Matrix

| Issue Type | Primary Contact | Secondary | Executive |
|------------|----------------|-----------|-----------|
| P0 Outage | On-call Engineer | DevOps Lead | CTO |
| Security | Security Team | CISO | CEO |
| Data Loss | Database Admin | DevOps Lead | CTO |
| Legal | Legal Team | Product Owner | CEO |

### Communication Templates

**Incident Notification**:
```
INCIDENT ALERT - P0
Service: VibeSheets
Status: Investigating
Impact: [Description]
ETA: [Time]
Next Update: [Time]
```

**Resolution Notification**:
```
INCIDENT RESOLVED - P0
Service: VibeSheets
Status: Resolved
Duration: [Time]
Root Cause: [Description]
Post-mortem: [Link]
```

---

This runbook should be kept up to date and accessible to all team members. Regular drills should be conducted to ensure procedures are current and effective.