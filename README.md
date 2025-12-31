
<h1 align="center">RepoSwarm</h1>

<p align="center">
  <strong>AI-Powered Repository Analysis & Architecture Discovery</strong>
</p>

<p align="center">
  <a href="https://github.com/adverant/Adverant-Nexus-Plugin-RepoSwarm/actions"><img src="https://github.com/adverant/Adverant-Nexus-Plugin-RepoSwarm/workflows/CI/badge.svg" alt="CI Status"></a>
  <a href="https://github.com/adverant/Adverant-Nexus-Plugin-RepoSwarm/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License"></a>
  <a href="https://marketplace.adverant.ai/plugins/reposwarm"><img src="https://img.shields.io/badge/Nexus-Marketplace-purple.svg" alt="Nexus Marketplace"></a>
  <a href="https://discord.gg/adverant"><img src="https://img.shields.io/discord/123456789?color=7289da&label=Discord" alt="Discord"></a>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#use-cases">Use Cases</a> •
  <a href="#pricing">Pricing</a> •
  <a href="#documentation">Documentation</a>
</p>

---

## Transform Code Chaos into Clarity

**RepoSwarm** is a Nexus Marketplace plugin that uses multi-agent AI to analyze your repositories and generate comprehensive architecture documentation. Whether you're onboarding new developers, conducting technical due diligence, or ensuring compliance, RepoSwarm gives you instant insights into any codebase.

### Why RepoSwarm?

- **10x Faster Onboarding**: New team members understand your codebase in hours, not weeks
- **Instant Architecture Docs**: Generate `.arch.md` documentation automatically
- **Security-First Analysis**: OWASP Top 10 vulnerability detection built-in
- **Multi-Platform Support**: GitHub, GitLab, and Bitbucket repositories
- **Continuous Monitoring**: Track architecture drift over time

---

## Features

### Multi-Agent Analysis

RepoSwarm deploys 5 specialized AI agents that work together:

| Agent | Purpose |
|-------|---------|
| **Architecture Analyst** | Detects patterns, layers, and component relationships |
| **Security Reviewer** | Scans for vulnerabilities, secrets, and compliance issues |
| **Performance Analyst** | Identifies bottlenecks and optimization opportunities |
| **Documentation Expert** | Assesses completeness and clarity of existing docs |
| **Testing Analyst** | Evaluates test coverage and quality |

### Intelligent Type Detection

Automatically identifies your repository type:

- **Backend**: API services, microservices, databases
- **Frontend**: React, Vue, Angular, Next.js
- **Mobile**: iOS, Android, React Native, Flutter
- **Infrastructure**: Terraform, Kubernetes, CloudFormation
- **Library**: NPM packages, Python libraries, SDKs
- **Monorepo**: Multi-package repositories

### Output Formats

Export your analysis in multiple formats:

- **Markdown** (`.arch.md`) - Version-controllable documentation
- **PDF** - Share with stakeholders
- **HTML** - Interactive web-based report
- **JSON** - Integrate with other tools

---

## Quick Start

### Installation

```bash
# Via Nexus Marketplace (Recommended)
nexus plugin install nexus-reposwarm

# Or via API
curl -X POST "https://api.adverant.ai/plugins/nexus-reposwarm/install" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Your First Analysis

```bash
# Analyze a repository
curl -X POST "https://api.adverant.ai/proxy/nexus-reposwarm/api/v1/analyze" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/your-org/your-repo",
    "analysisDepth": "standard",
    "includeSecurityScan": true
  }'
```

**Response:**
```json
{
  "analysisId": "ana_abc123",
  "status": "processing",
  "estimatedDuration": 120
}
```

### Check Results

```bash
curl "https://api.adverant.ai/proxy/nexus-reposwarm/api/v1/analysis/ana_abc123" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## Use Cases

### Enterprise

#### 1. M&A Technical Due Diligence
Evaluate acquisition targets in hours, not weeks. Get detailed architecture analysis, technical debt assessment, and security findings before signing.

#### 2. SOC2 Compliance Evidence
Generate compliance documentation automatically. RepoSwarm maps your security controls to SOC2 requirements and produces audit-ready reports.

#### 3. Legacy System Documentation
Reverse-engineer undocumented legacy codebases. Create architecture documentation that makes refactoring and modernization possible.

### Startup

#### 4. 10x Faster Developer Onboarding
New hires understand your codebase in their first day. Interactive architecture docs reduce ramp-up time from weeks to hours.

#### 5. Investor-Ready Technical Documentation
Impress VCs with professional technical documentation. Show your architecture is scalable, secure, and well-designed.

### Open Source

#### 6. Contributor Documentation Generation
Make your project more accessible. Generate comprehensive contributor guides that lower the barrier to entry.

#### 7. Security Transparency Reports
Build trust with your community. Publish regular security analysis reports showing your commitment to security.

### DevOps

#### 8. Architecture Drift Detection
Monitor changes over time. Get alerted when architecture patterns deviate from your intended design.

#### 9. CI/CD Integration
Integrate analysis into your pipeline. Block merges that introduce security vulnerabilities or architectural anti-patterns.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      RepoSwarm Plugin                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │    Repo     │  │   Prompt    │  │  Analysis Orchestrator  │ │
│  │   Manager   │  │   Engine    │  │  (MageAgent Integration)│ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
│         │                │                      │               │
│         ▼                ▼                      ▼               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │               Multi-Agent Analysis Engine                   ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────┐ ││
│  │  │Architect│ │Security │ │ Perf    │ │  Docs   │ │Testing│ ││
│  │  │ Agent   │ │ Agent   │ │ Agent   │ │ Agent   │ │Agent  │ ││
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  Output Generator                            ││
│  │         .arch.md  │  PDF  │  HTML  │  JSON                  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Nexus Core Services                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │MageAgent │  │ GraphRAG │  │FileProc  │  │ Billing  │        │
│  │ (AI)     │  │ (Cache)  │  │(Files)   │  │(Usage)   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pricing

| Feature | Free | Starter | Pro | Enterprise |
|---------|------|---------|-----|------------|
| **Price** | $0/mo | $29/mo | $99/mo | $499/mo |
| **Analyses/month** | 5 | 50 | 500 | Unlimited |
| **Max repo size** | 50 MB | 500 MB | 2 GB | Unlimited |
| **Analysis depth** | Quick | Standard | Deep | Deep |
| **Security scan** | - | ✓ | ✓ | ✓ |
| **Monitoring** | - | - | ✓ | ✓ |
| **Webhooks** | - | - | ✓ | ✓ |
| **Export formats** | MD, JSON | +HTML | +PDF | All |
| **Priority support** | - | - | - | ✓ |
| **Custom prompts** | - | - | - | ✓ |
| **SLA** | - | - | - | 99.9% |

[View on Nexus Marketplace →](https://marketplace.adverant.ai/plugins/reposwarm)

---

## Documentation

- [Installation Guide](docs/getting-started/installation.md)
- [Configuration](docs/getting-started/configuration.md)
- [Quick Start](docs/getting-started/quickstart.md)
- [API Reference](docs/api-reference/endpoints.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Use Cases](docs/use-cases/)

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/analyze` | Start repository analysis |
| `GET` | `/analysis/:id` | Get analysis result |
| `POST` | `/analyze/batch` | Batch analysis |
| `GET` | `/history` | Analysis history |
| `GET` | `/export/:id` | Export analysis |
| `POST` | `/monitors` | Create monitor |
| `GET` | `/monitors` | List monitors |

Full API documentation: [docs/api-reference/endpoints.md](docs/api-reference/endpoints.md)

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/adverant/Adverant-Nexus-Plugin-RepoSwarm.git
cd Adverant-Nexus-Plugin-RepoSwarm

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

---

## Community & Support

- **Documentation**: [docs.adverant.ai/plugins/reposwarm](https://docs.adverant.ai/plugins/reposwarm)
- **Discord**: [discord.gg/adverant](https://discord.gg/adverant)
- **Email**: support@adverant.ai
- **GitHub Issues**: [Report a bug](https://github.com/adverant/Adverant-Nexus-Plugin-RepoSwarm/issues)

---

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Built with ❤️ by <a href="https://adverant.ai">Adverant</a></strong>
</p>

<p align="center">
  <a href="https://adverant.ai">Website</a> •
  <a href="https://docs.adverant.ai">Docs</a> •
  <a href="https://marketplace.adverant.ai">Marketplace</a> •
  <a href="https://twitter.com/adverant">Twitter</a>
</p>
