# 🚀 API Documentation

Base URL: `https://api.vibesheets.com/prod`

## 🔐 Authentication

All API endpoints (except `/auth`) require JWT authentication via Auth0.

**Headers:**
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## 📋 Projects API

### Get Projects
```http
GET /projects
GET /projects?status=active
GET /projects?status=archived
```

**Response:**
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Website Redesign",
      "client": "Acme Corp",
      "status": "active",
      "rate": 75.00,
      "rateType": "hourly",
      "description": "Complete website redesign",
      "clientEmail": "contact@acme.com",
      "clientAddress": "123 Business St",
      "invoiceTerms": "monthly",
      "customDateRange": "",
      "invoiceNotes": "Thank you!",
      "totalHours": 24.5,
      "thisWeek": 8.0,
      "createdDate": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

### Create Project
```http
POST /projects
```

**Request Body:**
```json
{
  "name": "New Project",
  "client": "Client Name",
  "rate": 85.00,
  "description": "Project description",
  "clientEmail": "client@example.com",
  "clientAddress": "Client address",
  "invoiceTerms": "monthly",
  "customDateRange": "",
  "invoiceNotes": "Thank you for your business!"
}
```

**Response:**
```json
{
  "message": "Project created successfully",
  "project": { /* project object */ }
}
```

**Business Rules:**
- Free tier: Maximum 1 active project per user
- Returns 400 error if limit exceeded

### Update Project
```http
PUT /projects/{projectId}
```

**Request Body:** (any subset of project fields)
```json
{
  "name": "Updated Project Name",
  "status": "archived",
  "rate": 90.00
}
```

**Response:**
```json
{
  "message": "Project updated successfully",
  "project": { /* updated project object */ }
}
```

### Delete Project
```http
DELETE /projects/{projectId}
```

**Response:**
```json
{
  "message": "Project deleted successfully",
  "projectId": "uuid"
}
```

## ⏰ Time Tracking API

### Clock In/Out
```http
POST /clock
```

**Request Body:**
```json
{
  "action": "in",  // or "out"
  "project_id": "uuid",
  "timestamp": "2024-01-15T14:30:00Z"
}
```

### Get Clock Status
```http
GET /status
```

**Response:**
```json
{
  "status": "clocked_in",  // or "clocked_out"
  "clock_in_time": "2024-01-15T09:00:00Z",
  "project_id": "uuid",
  "hours_today": 4.5
}
```

### Get Timesheets
```http
GET /timesheets
GET /timesheets?start_date=2024-01-01
GET /timesheets?end_date=2024-01-31
GET /timesheets?project_id=uuid
```

**Response:**
```json
{
  "entries": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "date": "2024-01-15",
      "clock_in": "2024-01-15T09:00:00Z",
      "clock_out": "2024-01-15T17:30:00Z",
      "hours": 8.5,
      "type": "work"
    }
  ],
  "total_hours": 40.0,
  "count": 5
}
```

### Update Timesheet Entry
```http
PUT /timesheets
```

**Request Body:**
```json
{
  "entry_id": "uuid",
  "hours": 7.5,
  "date": "2024-01-15",
  "notes": "Updated entry"
}
```

### Export Timesheets
```http
POST /export
```

**Request Body:**
```json
{
  "format": "csv",  // or "pdf"
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "project_id": "uuid"  // optional
}
```

**Response:**
```json
{
  "download_url": "https://...",
  "expires_at": "2024-01-15T18:00:00Z"
}
```

## 🔑 Authentication API

### Get Auth Configuration
```http
GET /auth
```

**Response:**
```json
{
  "domain": "your-domain.auth0.com",
  "clientId": "your-client-id",
  "audience": "https://your-domain.auth0.com/api/v2/",
  "scope": "openid profile email"
}
```

## 💳 Stripe API (Premium Features)

### Get Stripe Configuration
```http
GET /stripe-config
```

### Create Payment Intent
```http
POST /stripe-payment
```

### Create Setup Intent
```http
POST /stripe-setup
```

### Webhook Handler
```http
POST /stripe-webhook
```

## ❌ Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* additional context */ }
}
```

### Common Error Codes
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (business rule violation)
- `500` - Internal Server Error

### Business Rule Errors
```json
{
  "error": "Free tier allows only one active project. Please archive your current project first.",
  "code": "FREE_TIER_LIMIT",
  "details": {
    "current_active_projects": 1,
    "limit": 1
  }
}
```

## 🔄 Rate Limiting

- **Rate Limit**: 1000 requests per hour per user
- **Headers**:
  - `X-RateLimit-Limit`: 1000
  - `X-RateLimit-Remaining`: 999
  - `X-RateLimit-Reset`: 1642349400

## 📈 Monitoring

All API calls are logged with:
- Request ID for tracing
- User ID for analytics
- Response time metrics
- Error rates and types

## 🧪 Testing

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```