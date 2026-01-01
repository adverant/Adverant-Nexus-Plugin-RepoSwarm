# RepoSwarm Quick Start Guide

**AI-powered repository analysis** - Analyze GitHub, GitLab, and Bitbucket repositories to generate architecture documentation, security findings, and actionable recommendations.

---

## The RepoSwarm Advantage

| Feature | Manual Code Review | RepoSwarm |
|---------|-------------------|-----------|
| Architecture Discovery | Manual documentation | AI-generated diagrams |
| Security Scanning | Separate tools | Integrated analysis |
| Documentation | Manual creation | Auto-generated |
| Onboarding Support | Tribal knowledge | Searchable insights |

**Analysis depth and results vary based on repository size and complexity.**

---

## Prerequisites

| Requirement | Minimum | Purpose |
|-------------|---------|---------|
| Nexus Platform | v1.0.0+ | Plugin runtime |
| Node.js | v20+ | SDK (TypeScript) |
| Python | v3.9+ | SDK (Python) |
| API Key | - | Authentication |
| Repository Access | - | GitHub/GitLab/Bitbucket token |

---

## Installation (Choose Your Method)

### Method 1: Nexus Marketplace (Recommended)

1. Navigate to **Marketplace** in your Nexus Dashboard
2. Search for "RepoSwarm"
3. Click **Install** and select your tier
4. The plugin activates automatically within 60 seconds

### Method 2: Nexus CLI

```bash
nexus plugin install nexus-reposwarm
nexus config set REPOSWARM_API_KEY your-api-key-here
```

### Method 3: Direct API

```bash
curl -X POST "https://api.adverant.ai/v1/plugins/install" \
  -H "Authorization: Bearer YOUR_NEXUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pluginId": "nexus-reposwarm",
    "tier": "professional",
    "autoActivate": true
  }'
```

---

## Your First Analysis: Step-by-Step

### Step 1: Set Your API Key

```bash
export NEXUS_API_KEY="your-api-key-here"
```

### Step 2: Analyze a Repository

```bash
curl -X POST "https://api.adverant.ai/proxy/nexus-reposwarm/api/v1/reposwarm/analyze" \
  -H "Authorization: Bearer $NEXUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/vercel/next.js",
    "branch": "main",
    "analysisDepth": "standard",
    "includeSecurityScan": true,
    "options": {
      "detectArchitecture": true,
      "detectPatterns": true,
      "generateDocs": true
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysisId": "analysis_Abc123xyz",
    "status": "processing",
    "repoUrl": "https://github.com/vercel/next.js",
    "estimatedCompletion": "2026-01-01T10:15:00Z",
    "queuePosition": 1
  }
}
```

### Step 3: Get Analysis Results

```bash
curl -X GET "https://api.adverant.ai/proxy/nexus-reposwarm/api/v1/reposwarm/analysis/analysis_Abc123xyz" \
  -H "Authorization: Bearer $NEXUS_API_KEY"
```

**Response:**
```json
{
  "analysisId": "analysis_Abc123xyz",
  "status": "completed",
  "repository": {
    "url": "https://github.com/vercel/next.js",
    "branch": "main",
    "languages": ["TypeScript", "JavaScript", "Rust"],
    "filesAnalyzed": 4523,
    "linesOfCode": 892451
  },
  "architecture": {
    "pattern": "Monorepo with Plugin Architecture",
    "framework": "Custom Build System (Turbopack)",
    "structure": {
      "packages": 42,
      "entryPoints": 8,
      "sharedLibraries": 15
    },
    "diagram": "```mermaid\nflowchart TB\n..."
  },
  "security": {
    "score": 87,
    "findings": [
      {
        "severity": "medium",
        "type": "dependency_vulnerability",
        "description": "Outdated dependency with known CVE",
        "location": "packages/next/package.json",
        "recommendation": "Update 'lodash' to version 4.17.21+"
      }
    ]
  },
  "recommendations": [
    {
      "category": "performance",
      "priority": "high",
      "title": "Bundle Size Optimization",
      "description": "Consider tree-shaking unused exports in shared packages"
    }
  ],
  "documentation": {
    "readme": "# Architecture Overview\n\n...",
    "apiDocs": "## API Reference\n\n..."
  }
}
```

### Step 4: Export Analysis

```bash
curl -X GET "https://api.adverant.ai/proxy/nexus-reposwarm/api/v1/reposwarm/export/analysis_Abc123xyz?format=pdf" \
  -H "Authorization: Bearer $NEXUS_API_KEY"
```

---

## Core API Endpoints

**Base URL:** `https://api.adverant.ai/proxy/nexus-reposwarm/api/v1/reposwarm`

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| `POST` | `/analyze` | Start repository analysis | 10/min |
| `GET` | `/analysis/:analysisId` | Get analysis result | 60/min |
| `POST` | `/analyze/batch` | Batch analysis | 2/min |
| `GET` | `/history` | Get analysis history | 60/min |
| `GET` | `/export/:analysisId` | Export analysis | 30/min |
| `GET` | `/compare` | Compare two analyses | 30/min |
| `POST` | `/monitors` | Create repository monitor | 10/min |
| `GET` | `/monitors` | List all monitors | 60/min |
| `PATCH` | `/monitors/:monitorId` | Update a monitor | 30/min |
| `DELETE` | `/monitors/:monitorId` | Delete a monitor | 30/min |
| `POST` | `/webhooks` | Register webhook | 10/min |
| `GET` | `/webhooks` | List webhooks | 60/min |

---

## SDK Examples

### TypeScript/JavaScript

```typescript
import { NexusClient } from '@adverant/nexus-sdk';

const nexus = new NexusClient({
  apiKey: process.env.NEXUS_API_KEY!
});

const reposwarm = nexus.plugin('nexus-reposwarm');

// Analyze a repository
const analysis = await reposwarm.analyze({
  repoUrl: 'https://github.com/facebook/react',
  branch: 'main',
  analysisDepth: 'deep',
  includeSecurityScan: true,
  options: {
    detectArchitecture: true,
    detectPatterns: true,
    generateDocs: true,
    includeTestAnalysis: true
  }
});

console.log(`Analysis started: ${analysis.analysisId}`);

// Poll for completion
let result = await reposwarm.getAnalysis({ analysisId: analysis.analysisId });
while (result.status !== 'completed') {
  await new Promise(r => setTimeout(r, 5000));
  result = await reposwarm.getAnalysis({ analysisId: analysis.analysisId });
  console.log(`Status: ${result.status}`);
}

// View architecture findings
console.log(`Architecture: ${result.architecture.pattern}`);
console.log(`Security Score: ${result.security.score}/100`);
console.log(`Findings: ${result.security.findings.length}`);

// Export to multiple formats
const markdownExport = await reposwarm.export({
  analysisId: analysis.analysisId,
  format: 'markdown'
});

const pdfExport = await reposwarm.export({
  analysisId: analysis.analysisId,
  format: 'pdf'
});

console.log(`Markdown: ${markdownExport.downloadUrl}`);
console.log(`PDF: ${pdfExport.downloadUrl}`);

// Set up continuous monitoring
const monitor = await reposwarm.monitors.create({
  repoUrl: 'https://github.com/facebook/react',
  schedule: 'weekly', // daily, weekly, monthly
  analysisDepth: 'standard',
  notifications: {
    email: 'team@company.com',
    slack: 'https://hooks.slack.com/...',
    onArchitectureChange: true,
    onSecurityFinding: true
  }
});

console.log(`Monitor created: ${monitor.monitorId}`);
```

### Python

```python
import os
import time
from nexus_sdk import NexusClient

client = NexusClient(api_key=os.environ["NEXUS_API_KEY"])
reposwarm = client.plugin("nexus-reposwarm")

# Analyze repository
analysis = reposwarm.analyze(
    repo_url="https://github.com/pallets/flask",
    branch="main",
    analysis_depth="deep",
    include_security_scan=True,
    options={
        "detect_architecture": True,
        "detect_patterns": True,
        "generate_docs": True
    }
)

print(f"Analysis ID: {analysis.analysis_id}")

# Wait for completion
result = reposwarm.get_analysis(analysis_id=analysis.analysis_id)
while result.status != "completed":
    time.sleep(5)
    result = reposwarm.get_analysis(analysis_id=analysis.analysis_id)
    print(f"Status: {result.status}")

# Display findings
print(f"\n=== Architecture ===")
print(f"Pattern: {result.architecture.pattern}")
print(f"Framework: {result.architecture.framework}")

print(f"\n=== Security ({result.security.score}/100) ===")
for finding in result.security.findings[:5]:
    print(f"- [{finding.severity}] {finding.description}")

print(f"\n=== Recommendations ===")
for rec in result.recommendations[:3]:
    print(f"- [{rec.priority}] {rec.title}")

# Compare with previous analysis
if previous_analysis_id:
    comparison = reposwarm.compare(
        analysis_a=previous_analysis_id,
        analysis_b=analysis.analysis_id
    )

    print(f"\n=== Changes ===")
    print(f"New files: {comparison.changes.files_added}")
    print(f"Deleted: {comparison.changes.files_removed}")
    print(f"Architecture drift: {comparison.architecture_drift}")

# Export documentation
export = reposwarm.export(
    analysis_id=analysis.analysis_id,
    format="html",
    include_diagrams=True
)

print(f"\nExport ready: {export.download_url}")
```

---

## Analysis Depths

| Depth | Files Analyzed | Time | Best For |
|-------|---------------|------|----------|
| **Quick** | 500 | 1-2 min | Fast overview, PR reviews |
| **Standard** | 2,000 | 5-10 min | Regular analysis, onboarding |
| **Deep** | 10,000+ | 15-30 min | Full audit, architecture review |

---

## Pricing

| Feature | Free | Starter | Professional | Enterprise |
|---------|------|---------|--------------|------------|
| **Monthly Price** | $0 | $29 | $99 | $499 |
| **Analyses/Month** | 5 | 50 | 500 | Unlimited |
| **Max Repo Size** | 50MB | 500MB | 2GB | Unlimited |
| **Max Files** | 500 | 2,000 | 10,000 | Unlimited |
| **Monitors** | - | 5 | 25 | Unlimited |
| **Analysis Depths** | Quick | Quick, Standard | All | All |
| **Security Scan** | - | Yes | Yes | Yes |
| **Webhooks** | - | - | Yes | Yes |
| **API Access** | - | - | Yes | Yes |
| **Custom Prompts** | - | - | - | Yes |
| **Private Deployment** | - | - | - | Yes |
| **Analysis Overage** | - | $1/each | $1/each | Custom |

**Free forever tier. 14-day trial on paid tiers.**

[Start Free](https://marketplace.adverant.ai/plugins/nexus-reposwarm)

---

## Rate Limits

| Tier | Requests/Minute | Concurrent Analyses | Timeout |
|------|-----------------|---------------------|---------|
| Free | 10 | 1 | 120s |
| Starter | 30 | 3 | 300s |
| Professional | 60 | 5 | 600s |
| Enterprise | Custom | Custom | Custom |

---

## Supported Platforms

| Platform | Public Repos | Private Repos | Self-Hosted |
|----------|--------------|---------------|-------------|
| **GitHub** | Yes | Yes | Enterprise |
| **GitLab** | Yes | Yes | Enterprise |
| **Bitbucket** | Yes | Yes | Enterprise |

---

## Next Steps

1. **[Use Cases Guide](./USE-CASES.md)** - Architecture discovery and security auditing workflows
2. **[Architecture Overview](./ARCHITECTURE.md)** - System design and AI analysis pipeline
3. **[API Reference](./docs/api-reference/endpoints.md)** - Complete endpoint documentation

---

## Support

| Channel | Response Time | Availability |
|---------|---------------|--------------|
| **Documentation** | Instant | [docs.adverant.ai/plugins/reposwarm](https://docs.adverant.ai/plugins/reposwarm) |
| **Discord Community** | < 2 hours | [discord.gg/adverant](https://discord.gg/adverant) |
| **Email Support** | < 24 hours | support@adverant.ai |
| **Priority Support** | < 1 hour | Enterprise only |

---

*RepoSwarm is built and maintained by [Adverant](https://adverant.ai) - Verified Nexus Plugin Developer*