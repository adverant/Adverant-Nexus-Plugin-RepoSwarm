# RepoSwarm - Technical Documentation

## API Reference

### Base URL

```
https://api.adverant.ai/proxy/nexus-reposwarm/api/v1/reposwarm
```

### Authentication

All API requests require a Bearer token in the Authorization header:

```bash
Authorization: Bearer YOUR_API_KEY
```

#### Required Scopes

| Scope | Description |
|-------|-------------|
| `reposwarm:read` | Read analysis results |
| `reposwarm:analyze` | Start new analyses |
| `reposwarm:monitor` | Access monitoring features |
| `reposwarm:export` | Export analysis reports |

---

## API Endpoints

### Repository Analysis

#### Start Repository Analysis

```http
POST /analyze
```

**Rate Limit:** 10 requests/minute

**Request Body:**

```json
{
  "repoUrl": "https://github.com/your-org/your-repo",
  "branch": "main",
  "analysisDepth": "quick | standard | deep",
  "includeSecurityScan": true,
  "options": {
    "analyzeDocumentation": true,
    "analyzeTests": true,
    "analyzePerformance": true,
    "generateArchDiagram": true,
    "customPrompts": []
  },
  "credentials": {
    "type": "token | ssh_key | oauth",
    "token": "ghp_xxxxxxxxxxxx"
  }
}
```

**Response:**

```json
{
  "analysisId": "ana_abc123",
  "status": "queued",
  "repoUrl": "https://github.com/your-org/your-repo",
  "branch": "main",
  "estimatedDuration": 120,
  "queuePosition": 3,
  "created_at": "2025-01-15T10:00:00Z"
}
```

#### Get Analysis Result

```http
GET /analysis/:analysisId
```

**Response:**

```json
{
  "analysisId": "ana_abc123",
  "status": "completed",
  "repoUrl": "https://github.com/your-org/your-repo",
  "branch": "main",
  "analysisDepth": "standard",
  "repository": {
    "name": "your-repo",
    "owner": "your-org",
    "platform": "github",
    "defaultBranch": "main",
    "stars": 1250,
    "forks": 320,
    "lastCommit": "2025-01-14T15:30:00Z",
    "primaryLanguage": "TypeScript",
    "languages": {
      "TypeScript": 75.5,
      "JavaScript": 15.2,
      "CSS": 8.1,
      "HTML": 1.2
    },
    "totalFiles": 450,
    "totalLines": 125000
  },
  "architecture": {
    "pattern": "modular_monolith",
    "type": "backend",
    "framework": "NestJS",
    "layers": [
      { "name": "Controllers", "path": "src/controllers", "files": 25 },
      { "name": "Services", "path": "src/services", "files": 32 },
      { "name": "Repositories", "path": "src/repositories", "files": 18 },
      { "name": "Entities", "path": "src/entities", "files": 15 }
    ],
    "dependencies": {
      "direct": 45,
      "dev": 28,
      "outdated": 8,
      "vulnerable": 2
    },
    "patterns_detected": [
      "Dependency Injection",
      "Repository Pattern",
      "DTO Validation",
      "Guard-based Auth"
    ],
    "diagram": "https://storage.adverant.ai/diagrams/ana_abc123.svg"
  },
  "security": {
    "score": 85,
    "grade": "B+",
    "vulnerabilities": [
      {
        "severity": "high",
        "type": "dependency",
        "package": "lodash@4.17.15",
        "cve": "CVE-2021-23337",
        "description": "Prototype pollution vulnerability",
        "recommendation": "Upgrade to lodash@4.17.21"
      },
      {
        "severity": "medium",
        "type": "code",
        "file": "src/auth/jwt.service.ts",
        "line": 45,
        "issue": "Weak JWT secret detection",
        "recommendation": "Use environment variable for JWT secret"
      }
    ],
    "secrets_detected": 0,
    "owasp_coverage": {
      "A01_Broken_Access_Control": "covered",
      "A02_Cryptographic_Failures": "partial",
      "A03_Injection": "covered"
    }
  },
  "quality": {
    "score": 78,
    "grade": "B",
    "metrics": {
      "maintainability_index": 72,
      "cyclomatic_complexity_avg": 8.5,
      "code_duplication_percentage": 3.2,
      "technical_debt_hours": 45
    },
    "issues": [
      {
        "type": "complexity",
        "file": "src/services/order.service.ts",
        "function": "processOrder",
        "complexity": 25,
        "recommendation": "Consider breaking into smaller functions"
      }
    ]
  },
  "testing": {
    "coverage": 72.5,
    "grade": "B",
    "breakdown": {
      "unit": { "files": 45, "coverage": 78 },
      "integration": { "files": 12, "coverage": 65 },
      "e2e": { "files": 5, "coverage": 45 }
    },
    "gaps": [
      "src/services/payment.service.ts - 0% coverage",
      "src/controllers/admin.controller.ts - 25% coverage"
    ]
  },
  "documentation": {
    "score": 65,
    "grade": "C",
    "findings": {
      "readme_exists": true,
      "readme_sections": ["Installation", "Usage"],
      "readme_missing": ["API Reference", "Contributing", "License"],
      "api_docs_percentage": 45,
      "inline_comments_percentage": 12
    },
    "recommendations": [
      "Add API documentation using Swagger/OpenAPI",
      "Include contributing guidelines",
      "Add code examples to README"
    ]
  },
  "performance": {
    "score": 70,
    "potential_issues": [
      {
        "type": "n_plus_one",
        "file": "src/services/user.service.ts",
        "line": 78,
        "description": "Potential N+1 query in getUsers loop"
      },
      {
        "type": "missing_index",
        "entity": "Order",
        "field": "createdAt",
        "description": "Frequently queried field without index"
      }
    ]
  },
  "recommendations": [
    {
      "priority": "high",
      "category": "security",
      "action": "Update lodash to 4.17.21",
      "effort": "low"
    },
    {
      "priority": "medium",
      "category": "testing",
      "action": "Add tests for payment service",
      "effort": "medium"
    }
  ],
  "summary": "Well-structured NestJS application with good separation of concerns. Main concerns are 2 high-severity dependency vulnerabilities and gaps in test coverage for critical payment flows. Documentation needs improvement for API reference.",
  "analyzed_at": "2025-01-15T10:02:00Z",
  "duration_seconds": 120
}
```

### Batch Analysis

#### Start Batch Analysis

```http
POST /analyze/batch
```

**Rate Limit:** 2 requests/minute

**Request Body:**

```json
{
  "repositories": [
    { "url": "https://github.com/org/repo1", "branch": "main" },
    { "url": "https://github.com/org/repo2", "branch": "main" },
    { "url": "https://github.com/org/repo3", "branch": "develop" }
  ],
  "analysisDepth": "standard",
  "options": {
    "includeSecurityScan": true,
    "generateComparison": true
  }
}
```

**Response:**

```json
{
  "batchId": "batch_xyz789",
  "status": "queued",
  "totalRepositories": 3,
  "estimatedDuration": 360,
  "analyses": [
    { "repoUrl": "https://github.com/org/repo1", "analysisId": "ana_001" },
    { "repoUrl": "https://github.com/org/repo2", "analysisId": "ana_002" },
    { "repoUrl": "https://github.com/org/repo3", "analysisId": "ana_003" }
  ]
}
```

### Analysis History

#### Get Analysis History

```http
GET /history
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Results per page (max 100) |
| `offset` | number | Pagination offset |
| `repo_url` | string | Filter by repository |
| `status` | string | Filter by status |
| `from_date` | string | Start date filter |
| `to_date` | string | End date filter |

**Response:**

```json
{
  "analyses": [
    {
      "analysisId": "ana_abc123",
      "repoUrl": "https://github.com/your-org/your-repo",
      "branch": "main",
      "status": "completed",
      "analysisDepth": "standard",
      "scores": {
        "security": 85,
        "quality": 78,
        "testing": 72,
        "documentation": 65
      },
      "created_at": "2025-01-15T10:00:00Z",
      "completed_at": "2025-01-15T10:02:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0
  }
}
```

### Export

#### Export Analysis

```http
GET /export/:analysisId
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | `md`, `pdf`, `html`, `json` |

**Response (format=json):**

Returns full analysis object.

**Response (format=md/pdf/html):**

```json
{
  "downloadUrl": "https://storage.adverant.ai/exports/ana_abc123.pdf",
  "expiresAt": "2025-01-16T10:00:00Z"
}
```

### Comparison

#### Compare Two Analyses

```http
GET /compare
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `analysis1` | string | First analysis ID |
| `analysis2` | string | Second analysis ID |

**Response:**

```json
{
  "comparison_id": "cmp_abc123",
  "analyses": ["ana_001", "ana_002"],
  "repositories": [
    { "url": "https://github.com/org/repo1", "branch": "main" },
    { "url": "https://github.com/org/repo2", "branch": "main" }
  ],
  "score_comparison": {
    "security": { "ana_001": 85, "ana_002": 72, "difference": -13 },
    "quality": { "ana_001": 78, "ana_002": 82, "difference": 4 },
    "testing": { "ana_001": 72, "ana_002": 68, "difference": -4 }
  },
  "architecture_differences": [
    {
      "aspect": "Framework",
      "ana_001": "NestJS",
      "ana_002": "Express"
    },
    {
      "aspect": "Pattern",
      "ana_001": "Modular Monolith",
      "ana_002": "Microservices"
    }
  ],
  "common_issues": [
    "Both repositories have outdated lodash dependency"
  ],
  "unique_issues": {
    "ana_001": ["Missing API documentation"],
    "ana_002": ["Low test coverage in auth module"]
  }
}
```

### Continuous Monitoring

#### Create Repository Monitor

```http
POST /monitors
```

**Request Body:**

```json
{
  "repoUrl": "https://github.com/your-org/your-repo",
  "branch": "main",
  "schedule": {
    "frequency": "daily | weekly | on_push",
    "time": "09:00",
    "timezone": "America/New_York"
  },
  "analysisDepth": "standard",
  "alerts": {
    "security_score_threshold": 70,
    "new_vulnerabilities": true,
    "coverage_drop_threshold": 5,
    "channels": ["email", "slack", "webhook"]
  },
  "webhook_url": "https://api.yourapp.com/webhook/reposwarm"
}
```

**Response:**

```json
{
  "monitorId": "mon_abc123",
  "repoUrl": "https://github.com/your-org/your-repo",
  "status": "active",
  "schedule": {
    "frequency": "daily",
    "next_run": "2025-01-16T09:00:00Z"
  },
  "created_at": "2025-01-15T10:00:00Z"
}
```

#### List Monitors

```http
GET /monitors
```

#### Update Monitor

```http
PATCH /monitors/:monitorId
```

#### Delete Monitor

```http
DELETE /monitors/:monitorId
```

### Webhooks

#### Register Webhook

```http
POST /webhooks
```

**Request Body:**

```json
{
  "url": "https://api.yourapp.com/webhook/reposwarm",
  "events": ["analysis.completed", "analysis.failed", "alert.triggered"],
  "secret": "your_webhook_secret"
}
```

#### List Webhooks

```http
GET /webhooks
```

---

## Rate Limits

| Tier | Analyses/month | Batch/min | Monitors |
|------|----------------|-----------|----------|
| Free | 5 | - | 0 |
| Starter | 50 | 1 | 5 |
| Professional | 500 | 2 | 25 |
| Enterprise | Unlimited | 5 | Unlimited |

---

## Data Models

### Analysis

```typescript
interface Analysis {
  analysisId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  repoUrl: string;
  branch: string;
  analysisDepth: 'quick' | 'standard' | 'deep';
  repository: RepositoryInfo;
  architecture: ArchitectureAnalysis;
  security: SecurityAnalysis;
  quality: QualityAnalysis;
  testing: TestingAnalysis;
  documentation: DocumentationAnalysis;
  performance: PerformanceAnalysis;
  recommendations: Recommendation[];
  summary: string;
  created_at: string;
  completed_at?: string;
  duration_seconds?: number;
}

interface RepositoryInfo {
  name: string;
  owner: string;
  platform: 'github' | 'gitlab' | 'bitbucket';
  defaultBranch: string;
  stars: number;
  forks: number;
  lastCommit: string;
  primaryLanguage: string;
  languages: Record<string, number>;
  totalFiles: number;
  totalLines: number;
}

interface ArchitectureAnalysis {
  pattern: string;
  type: 'backend' | 'frontend' | 'fullstack' | 'mobile' | 'library' | 'infrastructure';
  framework?: string;
  layers: Layer[];
  dependencies: DependencyInfo;
  patterns_detected: string[];
  diagram?: string;
}

interface SecurityAnalysis {
  score: number;
  grade: string;
  vulnerabilities: Vulnerability[];
  secrets_detected: number;
  owasp_coverage: Record<string, string>;
}

interface Vulnerability {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'dependency' | 'code' | 'configuration';
  package?: string;
  cve?: string;
  file?: string;
  line?: number;
  description: string;
  recommendation: string;
}
```

### Monitor

```typescript
interface Monitor {
  monitorId: string;
  repoUrl: string;
  branch: string;
  status: 'active' | 'paused' | 'error';
  schedule: MonitorSchedule;
  analysisDepth: string;
  alerts: AlertConfig;
  last_run?: string;
  next_run?: string;
  run_count: number;
  created_at: string;
  updated_at: string;
}

interface MonitorSchedule {
  frequency: 'daily' | 'weekly' | 'on_push';
  time?: string;
  timezone?: string;
  days_of_week?: string[];
}

interface AlertConfig {
  security_score_threshold?: number;
  quality_score_threshold?: number;
  new_vulnerabilities: boolean;
  coverage_drop_threshold?: number;
  channels: string[];
}
```

---

## SDK Integration

### JavaScript/TypeScript

```typescript
import { NexusClient } from '@adverant/nexus-sdk';

const client = new NexusClient({
  apiKey: process.env.NEXUS_API_KEY
});

// Start analysis
const analysis = await client.reposwarm.analyze({
  repoUrl: 'https://github.com/your-org/your-repo',
  branch: 'main',
  analysisDepth: 'standard',
  includeSecurityScan: true
});

// Wait for completion
const result = await client.reposwarm.waitForCompletion(analysis.analysisId, {
  timeout: 300000,
  pollInterval: 5000
});

console.log(`Security Score: ${result.security.score}`);
console.log(`Quality Score: ${result.quality.score}`);
console.log(`Vulnerabilities: ${result.security.vulnerabilities.length}`);

// Export as PDF
const pdf = await client.reposwarm.export(analysis.analysisId, { format: 'pdf' });
console.log(`Download: ${pdf.downloadUrl}`);

// Set up monitoring
const monitor = await client.reposwarm.monitors.create({
  repoUrl: 'https://github.com/your-org/your-repo',
  schedule: { frequency: 'daily', time: '09:00' },
  alerts: {
    security_score_threshold: 70,
    new_vulnerabilities: true
  }
});
```

### Python

```python
from nexus_sdk import NexusClient

client = NexusClient(api_key=os.environ["NEXUS_API_KEY"])

# Start analysis
analysis = client.reposwarm.analyze(
    repo_url="https://github.com/your-org/your-repo",
    branch="main",
    analysis_depth="standard",
    include_security_scan=True
)

# Wait for completion
result = client.reposwarm.wait_for_completion(analysis["analysisId"])

print(f"Architecture: {result['architecture']['pattern']}")
print(f"Security Grade: {result['security']['grade']}")

# Print vulnerabilities
for vuln in result["security"]["vulnerabilities"]:
    print(f"  [{vuln['severity']}] {vuln['description']}")

# Print recommendations
for rec in result["recommendations"]:
    print(f"  [{rec['priority']}] {rec['action']}")

# Batch analysis
batch = client.reposwarm.batch([
    {"url": "https://github.com/org/repo1"},
    {"url": "https://github.com/org/repo2"}
])
```

---

## Webhook Events

| Event | Description |
|-------|-------------|
| `analysis.queued` | Analysis added to queue |
| `analysis.started` | Analysis processing started |
| `analysis.completed` | Analysis finished successfully |
| `analysis.failed` | Analysis encountered error |
| `monitor.triggered` | Scheduled monitor run |
| `alert.security` | Security threshold breach |
| `alert.quality` | Quality threshold breach |
| `alert.vulnerability` | New vulnerability detected |

### Webhook Payload

```json
{
  "event": "analysis.completed",
  "timestamp": "2025-01-15T10:02:00Z",
  "data": {
    "analysisId": "ana_abc123",
    "repoUrl": "https://github.com/your-org/your-repo",
    "scores": {
      "security": 85,
      "quality": 78,
      "testing": 72,
      "documentation": 65
    },
    "vulnerabilities_count": 2,
    "high_severity_count": 1
  }
}
```

---

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `ANALYSIS_NOT_FOUND` | 404 | Analysis does not exist |
| `REPO_NOT_ACCESSIBLE` | 400 | Cannot access repository |
| `INVALID_CREDENTIALS` | 401 | Repository credentials invalid |
| `REPO_TOO_LARGE` | 400 | Repository exceeds size limit |
| `ANALYSIS_LIMIT_EXCEEDED` | 402 | Monthly analysis limit reached |
| `MONITOR_LIMIT_EXCEEDED` | 402 | Monitor limit for tier exceeded |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

---

## Deployment Requirements

### Container Specifications

| Resource | Value |
|----------|-------|
| CPU | 1000m (1 core) |
| Memory | 2048 MB |
| Disk | 10 GB |
| Timeout | 600,000 ms (10 min) |
| Max Concurrent Jobs | 5 |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis for job queue |
| `MAGEAGENT_URL` | Yes | MageAgent for AI analysis |
| `GRAPHRAG_URL` | Yes | GraphRAG for caching |
| `GITHUB_APP_ID` | Yes | GitHub App ID |
| `GITHUB_APP_KEY` | Yes | GitHub App private key |
| `GITLAB_TOKEN` | Optional | GitLab personal access token |
| `BITBUCKET_KEY` | Optional | Bitbucket API key |

### Health Checks

| Endpoint | Purpose |
|----------|---------|
| `/health` | General health check |
| `/ready` | Readiness probe |
| `/live` | Liveness probe |

---

## Quotas and Limits

### By Pricing Tier

| Limit | Free | Starter | Professional | Enterprise |
|-------|------|---------|--------------|------------|
| Analyses/month | 5 | 50 | 500 | Unlimited |
| Max Repo Size | 50 MB | 500 MB | 2 GB | Unlimited |
| Max Files/Analysis | 500 | 2,000 | 10,000 | Unlimited |
| Analysis Depth | Quick | Standard | Deep | Deep |
| Security Scan | - | Yes | Yes | Yes |
| Monitoring | - | 5 monitors | 25 monitors | Unlimited |
| Webhooks | - | - | Yes | Yes |
| Export Formats | MD, JSON | +HTML | +PDF | All |
| Custom Prompts | - | - | - | Yes |
| SLA | - | - | - | 99.9% |

### Pricing

| Tier | Monthly | Annual |
|------|---------|--------|
| Free | $0 | $0 |
| Starter | $29 | $290 |
| Professional | $99 | $990 |
| Enterprise | $499 | $4,990 |

### Overage Pricing

| Usage | Price |
|-------|-------|
| Additional analysis | $1.00 |
| Storage per GB | $0.50/month |
| Monitor check | $0.10 |

---

## Support

- **Documentation**: [docs.adverant.ai/plugins/reposwarm](https://docs.adverant.ai/plugins/reposwarm)
- **Discord**: [discord.gg/adverant](https://discord.gg/adverant)
- **Email**: support@adverant.ai
- **GitHub Issues**: [Report a bug](https://github.com/adverant/Adverant-Nexus-Plugin-RepoSwarm/issues)
