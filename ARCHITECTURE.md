# RepoSwarm Architecture

Technical architecture and system design for AI-powered repository analysis.

---

## System Overview

```mermaid
flowchart TB
    subgraph Client Layer
        A[Nexus Dashboard] --> B[API Gateway]
        C[SDK Clients] --> B
        D[Webhooks] --> B
    end

    subgraph RepoSwarm Service
        B --> E[REST API Layer]
        E --> F[Analysis Orchestrator]
        E --> G[Monitor Manager]
        E --> H[Export Engine]
        F --> I[Clone Service]
        F --> J[Scanner Pool]
        F --> K[AI Analysis Engine]
    end

    subgraph Git Platforms
        I --> L[GitHub API]
        I --> M[GitLab API]
        I --> N[Bitbucket API]
    end

    subgraph AI Services
        K --> O[MageAgent Orchestrator]
        O --> P[Code Analysis Agents]
        O --> Q[Security Agents]
        O --> R[Documentation Agents]
    end

    subgraph Knowledge Layer
        K --> S[GraphRAG]
        S --> T[Pattern Cache]
        S --> U[Finding History]
    end

    subgraph Data Layer
        F --> V[(PostgreSQL)]
        G --> V
        I --> W[(Temp Storage)]
        H --> X[(Export Storage)]
    end
```

---

## Core Components

### 1. REST API Layer

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/reposwarm/analyze` | POST | Start repository analysis |
| `/api/v1/reposwarm/analysis/:analysisId` | GET | Get analysis result |
| `/api/v1/reposwarm/analyze/batch` | POST | Batch analysis |
| `/api/v1/reposwarm/history` | GET | Get analysis history |
| `/api/v1/reposwarm/export/:analysisId` | GET | Export analysis |
| `/api/v1/reposwarm/compare` | GET | Compare analyses |
| `/api/v1/reposwarm/monitors` | POST | Create monitor |
| `/api/v1/reposwarm/monitors` | GET | List monitors |
| `/api/v1/reposwarm/monitors/:monitorId` | PATCH | Update monitor |
| `/api/v1/reposwarm/monitors/:monitorId` | DELETE | Delete monitor |
| `/api/v1/reposwarm/webhooks` | POST | Register webhook |
| `/api/v1/reposwarm/webhooks` | GET | List webhooks |

### 2. Analysis Orchestrator

Coordinates the multi-stage analysis pipeline.

**Capabilities:**
- Job queuing and prioritization
- Progress tracking
- Timeout management
- Error recovery

### 3. Clone Service

Handles repository cloning with platform-specific authentication.

**Supported Platforms:**
- GitHub (cloud and enterprise)
- GitLab (cloud and self-hosted)
- Bitbucket (cloud and server)

### 4. Scanner Pool

Parallel code scanning for different analysis types.

**Scanner Types:**
- Language detection
- Dependency extraction
- Pattern recognition
- Security scanning
- Test coverage analysis

### 5. AI Analysis Engine

Multi-agent AI analysis using MageAgent.

**Agent Types:**
- Architecture discovery agents
- Code quality agents
- Security vulnerability agents
- Documentation analysis agents
- Recommendation agents

### 6. Monitor Manager

Continuous repository monitoring.

**Features:**
- Scheduled analysis
- Change detection
- Alert management
- Webhook notifications

### 7. Export Engine

Multi-format report generation.

**Formats:**
- Markdown
- HTML (interactive)
- PDF
- JSON

---

## Analysis Pipeline

```mermaid
flowchart TB
    subgraph Input
        A[Analysis Request] --> B[Validation]
        B --> C[Queue Job]
    end

    subgraph Clone Phase
        C --> D[Clone Repository]
        D --> E[Extract Metadata]
        E --> F[Language Detection]
    end

    subgraph Scan Phase
        F --> G[Parallel Scanners]
        G --> H[Dependency Scanner]
        G --> I[Pattern Scanner]
        G --> J[Security Scanner]
        G --> K[Test Scanner]
    end

    subgraph AI Phase
        H --> L[MageAgent Orchestrator]
        I --> L
        J --> L
        K --> L
        L --> M[Architecture Agent]
        L --> N[Quality Agent]
        L --> O[Security Agent]
        L --> P[Documentation Agent]
    end

    subgraph Output
        M --> Q[Aggregate Results]
        N --> Q
        O --> Q
        P --> Q
        Q --> R[Generate Report]
        R --> S[Store Results]
        S --> T[Notify Client]
    end
```

---

## Architecture Discovery Engine

```mermaid
flowchart TB
    subgraph Input Analysis
        A[Repository Files] --> B[Entry Point Detection]
        B --> C[Import/Dependency Graph]
        C --> D[Module Boundary Detection]
    end

    subgraph Pattern Recognition
        D --> E[Pattern Library Match]
        E --> F{Pattern Found?}
        F -->|Yes| G[Confirm Pattern]
        F -->|No| H[AI Pattern Discovery]
        H --> I[New Pattern Classification]
    end

    subgraph Architecture Mapping
        G --> J[Component Mapping]
        I --> J
        J --> K[Layer Detection]
        K --> L[Data Flow Analysis]
        L --> M[API Surface Detection]
    end

    subgraph Output
        M --> N[Architecture Model]
        N --> O[Mermaid Diagrams]
        N --> P[Recommendations]
    end
```

---

## Security Scanning Pipeline

```mermaid
flowchart TB
    subgraph Static Analysis
        A[Source Code] --> B[Secret Detection]
        A --> C[Vulnerability Patterns]
        A --> D[SAST Analysis]
    end

    subgraph Dependency Analysis
        E[Package Manifests] --> F[CVE Database Check]
        E --> G[License Analysis]
        E --> H[Deprecated Check]
    end

    subgraph Configuration Analysis
        I[Config Files] --> J[Misconfig Detection]
        I --> K[Exposed Credentials]
        I --> L[Insecure Defaults]
    end

    subgraph AI Analysis
        B --> M[AI Security Agent]
        C --> M
        D --> M
        F --> M
        J --> M
        M --> N[Severity Classification]
        M --> O[Remediation Suggestions]
    end

    subgraph Output
        N --> P[Security Report]
        O --> P
        P --> Q[Compliance Mapping]
    end
```

---

## Data Model

```mermaid
erDiagram
    ANALYSES ||--o{ FINDINGS : contains
    ANALYSES ||--o{ ARCHITECTURE_COMPONENTS : discovers
    ANALYSES ||--o{ DEPENDENCIES : extracts
    ANALYSES ||--o{ EXPORTS : generates
    MONITORS ||--o{ ANALYSES : triggers
    MONITORS ||--o{ ALERTS : sends
    BASELINES ||--o{ ANALYSES : compares

    ANALYSES {
        uuid analysis_id PK
        string repo_url
        string branch
        string status
        string analysis_depth
        jsonb options
        jsonb results
        integer files_analyzed
        integer lines_of_code
        timestamp started_at
        timestamp completed_at
    }

    FINDINGS {
        uuid finding_id PK
        uuid analysis_id FK
        string category
        string severity
        string type
        text description
        string location
        text recommendation
        jsonb metadata
    }

    ARCHITECTURE_COMPONENTS {
        uuid component_id PK
        uuid analysis_id FK
        string name
        string type
        string layer
        array dependencies
        jsonb metadata
    }

    DEPENDENCIES {
        uuid dependency_id PK
        uuid analysis_id FK
        string name
        string version
        string type
        string license
        boolean has_vulnerability
        array cves
    }

    MONITORS {
        uuid monitor_id PK
        string repo_url
        string schedule
        string analysis_depth
        jsonb notification_config
        boolean active
        timestamp last_run
        timestamp next_run
    }

    ALERTS {
        uuid alert_id PK
        uuid monitor_id FK
        string type
        string severity
        text message
        jsonb data
        timestamp created_at
        boolean acknowledged
    }

    BASELINES {
        uuid baseline_id PK
        uuid analysis_id FK
        string name
        jsonb architecture_rules
        boolean is_current
        timestamp created_at
    }

    EXPORTS {
        uuid export_id PK
        uuid analysis_id FK
        string format
        string status
        string download_url
        timestamp created_at
        timestamp expires_at
    }
```

---

## Multi-Agent Analysis System

```mermaid
flowchart TB
    subgraph Orchestrator
        A[MageAgent Orchestrator] --> B[Task Decomposition]
        B --> C[Agent Assignment]
    end

    subgraph Agent Pool
        C --> D[Architecture Agent]
        C --> E[Security Agent]
        C --> F[Quality Agent]
        C --> G[Documentation Agent]
        C --> H[Performance Agent]
    end

    subgraph Specializations
        D --> I[Microservices Specialist]
        D --> J[Monolith Specialist]
        D --> K[Serverless Specialist]
        E --> L[OWASP Specialist]
        E --> M[Dependency Specialist]
        F --> N[Code Smell Detector]
        F --> O[Best Practices Checker]
    end

    subgraph Consensus
        I --> P[Result Aggregation]
        J --> P
        K --> P
        L --> P
        M --> P
        N --> P
        O --> P
        P --> Q[Confidence Scoring]
        Q --> R[Final Analysis]
    end
```

---

## Continuous Monitoring Architecture

```mermaid
flowchart TB
    subgraph Scheduler
        A[Cron Scheduler] --> B[Monitor Queue]
    end

    subgraph Execution
        B --> C[Analysis Pipeline]
        C --> D[Results]
    end

    subgraph Comparison
        D --> E{Baseline Exists?}
        E -->|Yes| F[Compare to Baseline]
        E -->|No| G[Store as Baseline]
        F --> H[Drift Detection]
    end

    subgraph Alerting
        H --> I{Threshold Exceeded?}
        I -->|Yes| J[Generate Alert]
        I -->|No| K[Log Results]
        J --> L[Notification Router]
        L --> M[Email]
        L --> N[Slack]
        L --> O[Webhook]
        L --> P[PagerDuty]
    end

    subgraph Actions
        J --> Q{Auto-Actions?}
        Q -->|Yes| R[Create GitHub Issue]
        Q -->|Yes| S[Update Dashboard]
    end
```

---

## Export Pipeline

```mermaid
flowchart TB
    subgraph Source
        A[Analysis Results] --> B[Export Request]
    end

    subgraph Processing
        B --> C{Format?}
        C -->|Markdown| D[Markdown Generator]
        C -->|HTML| E[HTML Generator]
        C -->|PDF| F[PDF Generator]
        C -->|JSON| G[JSON Generator]
    end

    subgraph Enhancement
        D --> H[Diagram Injection]
        E --> H
        H --> I[Interactive Elements]
        I --> J[Styling]
    end

    subgraph Output
        J --> K[Compress]
        F --> K
        G --> K
        K --> L[Upload to Storage]
        L --> M[Generate URL]
        M --> N[Set Expiration]
    end
```

---

## Security Model

### Authentication
- Bearer token via Nexus API Gateway
- Git platform tokens (encrypted storage)
- Webhook signature verification

### Authorization
- Analysis-level access control
- Organization scoping
- Monitor ownership

### Data Protection
- Repositories cloned to ephemeral storage
- Results encrypted at rest
- No source code retention beyond analysis
- Audit logging for all operations

---

## Deployment Architecture

### Kubernetes Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nexus-reposwarm
  namespace: nexus-plugins
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nexus-reposwarm
  template:
    spec:
      containers:
      - name: reposwarm-api
        image: adverant/nexus-reposwarm:1.0.0
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        env:
        - name: GITHUB_APP_ID
          valueFrom:
            secretKeyRef:
              name: reposwarm-secrets
              key: github-app-id
        volumeMounts:
        - name: temp-storage
          mountPath: /tmp/repos
        livenessProbe:
          httpGet:
            path: /live
            port: 8080
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
      volumes:
      - name: temp-storage
        emptyDir:
          sizeLimit: 10Gi
```

### Resource Allocation

| Component | CPU | Memory | Storage |
|-----------|-----|--------|---------|
| API Server | 500m-1000m | 1Gi-2Gi | - |
| Analysis Worker | 1000m-2000m | 2Gi-4Gi | 10Gi (ephemeral) |
| Clone Worker | 250m-500m | 512Mi-1Gi | 10Gi (ephemeral) |
| Export Worker | 500m-1000m | 1Gi-2Gi | 5Gi |

---

## Performance

### Analysis Capacity

| Tier | Concurrent Analyses | Max Repo Size | Files/Analysis |
|------|---------------------|---------------|----------------|
| Free | 1 | 50MB | 500 |
| Starter | 3 | 500MB | 2,000 |
| Professional | 5 | 2GB | 10,000 |
| Enterprise | Custom | Unlimited | Unlimited |

### Latency Targets

| Operation | Target |
|-----------|--------|
| Quick Analysis | < 2 min |
| Standard Analysis | < 10 min |
| Deep Analysis | < 30 min |
| Export Generation | < 60s |
| Monitor Check | < 5 min |

---

## Monitoring

### Metrics (Prometheus)

```
# Analysis metrics
reposwarm_analyses_total
reposwarm_analysis_duration_seconds
reposwarm_files_analyzed_total
reposwarm_lines_analyzed_total

# Security metrics
reposwarm_findings_total{severity="critical|high|medium|low"}
reposwarm_vulnerabilities_detected_total

# Monitor metrics
reposwarm_monitors_active
reposwarm_alerts_sent_total

# Performance metrics
reposwarm_clone_duration_seconds
reposwarm_scanner_duration_seconds
reposwarm_ai_analysis_duration_seconds
```

### Alerting

| Alert | Condition | Severity |
|-------|-----------|----------|
| Analysis Failure | > 5% failure rate | Critical |
| Clone Timeout | > 3 consecutive timeouts | Warning |
| Queue Backup | > 50 pending jobs | Warning |
| AI Agent Failure | Agent unreachable | Critical |

---

## Next Steps

- [Quick Start Guide](./QUICKSTART.md) - Get started quickly
- [Use Cases](./USE-CASES.md) - Analysis scenarios
- [API Reference](./docs/api-reference/endpoints.md) - Complete docs

