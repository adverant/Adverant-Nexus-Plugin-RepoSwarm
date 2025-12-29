# API Reference

Complete API documentation for RepoSwarm.

## Base URL

```
https://api.adverant.ai/proxy/nexus-reposwarm/api/v1
```

## Authentication

All requests require authentication via Bearer token:

```bash
-H "Authorization: Bearer YOUR_API_KEY"
```

## Endpoints

### Health Check

Check if the plugin is healthy.

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": "24h 30m"
}
```

---

### List Operations

Retrieve a list of past operations.

```http
GET /operations
```

**Query Parameters:**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `page` | integer | Page number | 1 |
| `limit` | integer | Items per page | 20 |
| `status` | string | Filter by status | - |

**Response:**
```json
{
  "operations": [
    {
      "id": "op_abc123",
      "status": "completed",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

---

### Create Operation

Start a new operation.

```http
POST /operations
```

**Request Body:**
```json
{
  "input": "string (required)",
  "options": {
    "depth": "standard",
    "webhook": "https://..."
  }
}
```

**Response:**
```json
{
  "operationId": "op_abc123",
  "status": "queued",
  "estimatedDuration": 30
}
```

---

### Get Operation

Retrieve operation details.

```http
GET /operations/:operationId
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `operationId` | string | Operation ID |

**Response:**
```json
{
  "id": "op_abc123",
  "status": "completed",
  "input": "...",
  "result": {},
  "createdAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:31:00Z"
}
```

---

### Export Result

Export operation result in various formats.

```http
GET /operations/:operationId/export
```

**Query Parameters:**

| Parameter | Type | Description | Options |
|-----------|------|-------------|---------|
| `format` | string | Export format | md, json, pdf, html |

**Response:**
File download in specified format.

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

Rate limits are enforced per API key:

| Tier | Limit | Window |
|------|-------|--------|
| Free | 10 | 1 minute |
| Starter | 60 | 1 minute |
| Pro | 300 | 1 minute |
| Enterprise | Custom | Custom |

When rate limited, you'll receive:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded",
    "details": {
      "retryAfter": 60
    }
  }
}
```

## Webhooks

Configure webhooks to receive operation completion events:

```http
POST /webhooks
```

```json
{
  "url": "https://your-server.com/webhook",
  "events": ["operation.completed", "operation.failed"]
}
```

Webhook payload:
```json
{
  "event": "operation.completed",
  "operationId": "op_abc123",
  "timestamp": "2024-01-15T10:31:00Z",
  "data": {}
}
```

## SDKs

Official SDKs available:
- [TypeScript/JavaScript](https://github.com/adverant/nexus-sdk-js)
- [Python](https://github.com/adverant/nexus-sdk-python)
