# Changelog

All notable changes to RepoSwarm will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release preparation
- Multi-agent analysis with 5 specialized agents
- Support for GitHub, GitLab, and Bitbucket repositories
- Automatic repository type detection
- Multiple export formats (Markdown, PDF, HTML, JSON)
- Continuous monitoring with webhooks
- GraphRAG integration for caching and pattern learning

## [1.0.0] - 2024-12-29

### Added
- **Multi-Agent Analysis**: Deploy 5 specialized AI agents for comprehensive repository analysis
  - Architecture Analyst: Pattern detection and component mapping
  - Security Reviewer: OWASP Top 10 vulnerability scanning
  - Performance Analyst: Bottleneck identification
  - Documentation Expert: Docs completeness assessment
  - Testing Analyst: Test coverage evaluation

- **Repository Type Detection**: Automatic detection of:
  - Backend services (Node.js, Python, Go, Java, etc.)
  - Frontend applications (React, Vue, Angular, Next.js)
  - Mobile applications (iOS, Android, React Native, Flutter)
  - Infrastructure-as-Code (Terraform, Kubernetes, CloudFormation)
  - Libraries and packages
  - Monorepos

- **Output Formats**:
  - Markdown (`.arch.md`) for version control
  - PDF for stakeholder sharing
  - HTML for interactive viewing
  - JSON for tool integration

- **Continuous Monitoring**:
  - Track repository changes over time
  - Webhook notifications on architecture drift
  - Configurable polling intervals

- **API Endpoints**:
  - `POST /analyze` - Start analysis
  - `GET /analysis/:id` - Get results
  - `POST /analyze/batch` - Batch analysis
  - `GET /history` - Analysis history
  - `GET /export/:id` - Export results
  - `POST /monitors` - Create monitor
  - `GET /monitors` - List monitors

- **Integration with Nexus Services**:
  - MageAgent for multi-agent orchestration
  - GraphRAG for caching and semantic search
  - FileProcess for document handling
  - Billing for usage tracking

### Security
- Automatic secrets detection and warning
- OWASP Top 10 vulnerability scanning
- Permission-based access control
- Secure temporary file handling

---

[Unreleased]: https://github.com/adverant/Adverant-Nexus-Plugin-RepoSwarm/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/adverant/Adverant-Nexus-Plugin-RepoSwarm/releases/tag/v1.0.0
