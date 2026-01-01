# RepoSwarm Use Cases

Real-world scenarios for AI-powered repository analysis and architecture discovery.

---

## Use Case 1: New Developer Onboarding

### Problem

New developers spend 4-6 weeks understanding a codebase before becoming productive. Tribal knowledge is lost when senior developers leave, and existing documentation is often outdated.

### Solution

AI-generated architecture documentation with interactive exploration.

### Implementation

```typescript
import { NexusClient } from '@adverant/nexus-sdk';

class DeveloperOnboarding {
  private reposwarm;

  constructor(nexusClient: NexusClient) {
    this.reposwarm = nexusClient.plugin('nexus-reposwarm');
  }

  async createOnboardingPackage(repoUrl: string, newDeveloperRole: string) {
    // Run comprehensive analysis
    const analysis = await this.reposwarm.analyze({
      repoUrl,
      branch: 'main',
      analysisDepth: 'deep',
      options: {
        detectArchitecture: true,
        detectPatterns: true,
        generateDocs: true,
        includeTestAnalysis: true,
        includeApiDocs: true,
        includeDataFlowDiagrams: true
      }
    });

    // Wait for completion
    let result = await this.pollForCompletion(analysis.analysisId);

    // Generate role-specific documentation
    const roleSpecificDocs = await this.reposwarm.generateRoleGuide({
      analysisId: analysis.analysisId,
      role: newDeveloperRole, // 'frontend', 'backend', 'fullstack', 'devops'
      include: [
        'architecture_overview',
        'key_files_for_role',
        'common_workflows',
        'testing_patterns',
        'deployment_process'
      ]
    });

    // Create interactive exploration guide
    const explorationGuide = await this.reposwarm.generateExplorationGuide({
      analysisId: analysis.analysisId,
      format: 'interactive',
      include: [
        'codebase_tour',
        'critical_paths',
        'common_modifications',
        'debugging_tips'
      ]
    });

    // Export as onboarding package
    const onboardingPackage = await this.reposwarm.export({
      analysisId: analysis.analysisId,
      format: 'html',
      includeInteractiveDiagrams: true,
      sections: [
        'architecture_overview',
        'component_breakdown',
        'data_flow',
        'api_reference',
        'testing_guide',
        roleSpecificDocs,
        explorationGuide
      ]
    });

    return {
      analysisId: analysis.analysisId,
      onboardingUrl: onboardingPackage.downloadUrl,
      estimatedOnboardingTime: '1-2 days',
      keyAreas: result.architecture.criticalPaths,
      suggestedFirstTasks: this.generateFirstTasks(result, newDeveloperRole)
    };
  }

  private async pollForCompletion(analysisId: string) {
    let result = await this.reposwarm.getAnalysis({ analysisId });
    while (result.status !== 'completed') {
      await new Promise(r => setTimeout(r, 5000));
      result = await this.reposwarm.getAnalysis({ analysisId });
    }
    return result;
  }

  private generateFirstTasks(analysis: any, role: string) {
    // AI-suggested first tasks based on codebase and role
    return analysis.recommendations
      .filter(r => r.category === 'good_first_issue')
      .slice(0, 5);
  }
}
```

### Business Impact

- **80% reduction in onboarding time** (4-6 weeks to 1-2 days)
- **Consistent onboarding** regardless of documentation state
- **Role-specific guidance** for immediate productivity
- **Self-service exploration** reduces senior developer interruptions

---

## Use Case 2: Security Audit and Vulnerability Assessment

### Problem

Manual security audits are expensive and time-consuming. Critical vulnerabilities go undetected, and dependency risks accumulate silently.

### Solution

Automated security scanning with AI-powered vulnerability analysis.

### Implementation

```python
class SecurityAudit:
    def __init__(self, nexus_client):
        self.reposwarm = nexus_client.plugin("nexus-reposwarm")

    async def full_security_audit(self, repo_url: str, compliance_frameworks: list = None):
        # Run security-focused analysis
        analysis = await self.reposwarm.analyze(
            repo_url=repo_url,
            branch="main",
            analysis_depth="deep",
            include_security_scan=True,
            options={
                "security_focus": True,
                "check_dependencies": True,
                "check_secrets": True,
                "check_code_vulnerabilities": True,
                "compliance_frameworks": compliance_frameworks or ["owasp", "cwe"]
            }
        )

        result = await self.wait_for_completion(analysis.analysis_id)

        # Categorize findings by severity
        findings_by_severity = {
            "critical": [],
            "high": [],
            "medium": [],
            "low": [],
            "info": []
        }

        for finding in result.security.findings:
            findings_by_severity[finding.severity].append(finding)

        # Generate remediation plan
        remediation_plan = await self.reposwarm.generate_remediation_plan(
            analysis_id=analysis.analysis_id,
            prioritize_by="severity_and_exploitability",
            include_code_fixes=True
        )

        # Check compliance status
        compliance_report = None
        if compliance_frameworks:
            compliance_report = await self.reposwarm.check_compliance(
                analysis_id=analysis.analysis_id,
                frameworks=compliance_frameworks
            )

        return {
            "analysis_id": analysis.analysis_id,
            "security_score": result.security.score,
            "findings_summary": {
                severity: len(findings)
                for severity, findings in findings_by_severity.items()
            },
            "critical_findings": findings_by_severity["critical"],
            "high_findings": findings_by_severity["high"],
            "remediation_plan": remediation_plan,
            "compliance": compliance_report,
            "dependency_risks": result.security.dependency_analysis,
            "secret_detection": result.security.secrets_found
        }

    async def continuous_security_monitoring(self, repo_url: str):
        # Set up continuous monitoring
        monitor = await self.reposwarm.monitors.create(
            repo_url=repo_url,
            schedule="daily",
            analysis_depth="standard",
            focus="security",
            notifications={
                "on_critical_finding": {
                    "channels": ["email", "slack", "pagerduty"],
                    "immediate": True
                },
                "on_new_dependency_vulnerability": {
                    "channels": ["email", "slack"],
                    "immediate": True
                },
                "on_secret_detected": {
                    "channels": ["email", "slack", "pagerduty"],
                    "immediate": True
                }
            },
            auto_create_issues=True,
            github_token="ghp_..."  # For auto-creating issues
        )

        return monitor

    async def dependency_audit(self, repo_url: str):
        analysis = await self.reposwarm.analyze(
            repo_url=repo_url,
            analysis_depth="standard",
            options={
                "focus": "dependencies",
                "check_license_compliance": True,
                "check_deprecated_packages": True,
                "check_outdated_packages": True,
                "check_known_vulnerabilities": True
            }
        )

        result = await self.wait_for_completion(analysis.analysis_id)

        return {
            "total_dependencies": result.dependencies.total,
            "direct_dependencies": result.dependencies.direct,
            "transitive_dependencies": result.dependencies.transitive,
            "vulnerable": result.dependencies.vulnerable,
            "outdated": result.dependencies.outdated,
            "deprecated": result.dependencies.deprecated,
            "license_issues": result.dependencies.license_issues,
            "upgrade_recommendations": result.dependencies.upgrades
        }
```

### Business Impact

- **90% faster security audits** than manual review
- **Continuous monitoring** catches vulnerabilities immediately
- **Automated remediation** suggestions with code fixes
- **Compliance tracking** for SOC2, HIPAA, PCI-DSS

---

## Use Case 3: Technical Due Diligence for M&A

### Problem

Acquiring companies need to understand technical debt, architecture quality, and risks before closing deals. Manual due diligence is expensive and often misses critical issues.

### Solution

Comprehensive codebase analysis for investment decisions.

### Implementation

```typescript
class TechnicalDueDiligence {
  private reposwarm;

  constructor(nexusClient: NexusClient) {
    this.reposwarm = nexusClient.plugin('nexus-reposwarm');
  }

  async conductDueDiligence(repositories: string[]) {
    // Analyze all repositories in parallel
    const analyses = await Promise.all(
      repositories.map(repo =>
        this.reposwarm.analyze({
          repoUrl: repo,
          analysisDepth: 'deep',
          includeSecurityScan: true,
          options: {
            detectArchitecture: true,
            detectTechnicalDebt: true,
            assessCodeQuality: true,
            detectPatterns: true,
            includeTestCoverage: true,
            calculateMaintainabilityIndex: true
          }
        })
      )
    );

    // Wait for all analyses to complete
    const results = await Promise.all(
      analyses.map(a => this.pollForCompletion(a.analysisId))
    );

    // Aggregate findings
    const aggregatedReport = {
      overallScore: this.calculateOverallScore(results),
      repositories: results.map(r => ({
        url: r.repository.url,
        healthScore: r.metrics.healthScore,
        technicalDebtHours: r.metrics.technicalDebtHours,
        testCoverage: r.metrics.testCoverage,
        maintainabilityIndex: r.metrics.maintainabilityIndex
      })),
      risks: this.aggregateRisks(results),
      strengths: this.aggregateStrengths(results),
      recommendations: this.prioritizeRecommendations(results)
    };

    // Generate executive summary
    const executiveSummary = await this.reposwarm.generateExecutiveSummary({
      analysisIds: analyses.map(a => a.analysisId),
      audience: 'non-technical',
      include: [
        'overall_health',
        'major_risks',
        'estimated_technical_debt',
        'team_size_estimate',
        'technology_stack_assessment'
      ]
    });

    // Generate detailed technical report
    const technicalReport = await this.reposwarm.export({
      analysisIds: analyses.map(a => a.analysisId),
      format: 'pdf',
      template: 'due_diligence',
      sections: [
        'executive_summary',
        'architecture_assessment',
        'code_quality_metrics',
        'security_findings',
        'technical_debt_analysis',
        'team_assessment',
        'risk_matrix',
        'recommendations'
      ]
    });

    return {
      aggregatedReport,
      executiveSummary,
      technicalReportUrl: technicalReport.downloadUrl,
      investmentRiskLevel: this.calculateInvestmentRisk(aggregatedReport)
    };
  }

  async assessTechnicalDebt(analysisId: string) {
    const debtAnalysis = await this.reposwarm.analyzeTechnicalDebt({
      analysisId,
      categories: [
        'code_duplication',
        'complex_functions',
        'missing_tests',
        'outdated_dependencies',
        'architecture_violations',
        'documentation_gaps'
      ],
      estimateHours: true,
      estimateCost: true
    });

    return {
      totalDebtHours: debtAnalysis.totalHours,
      estimatedCost: debtAnalysis.estimatedCost, // Based on avg dev rate
      breakdown: debtAnalysis.byCategory,
      prioritizedPayoff: debtAnalysis.prioritizedItems,
      payoffTimeline: debtAnalysis.recommendedPayoffPlan
    };
  }

  private calculateInvestmentRisk(report: any): string {
    const score = report.overallScore;
    if (score >= 80) return 'low';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'high';
    return 'critical';
  }
}
```

### Business Impact

- **Due diligence in days**, not weeks
- **Objective technical assessment** for investment decisions
- **Quantified technical debt** in dollars and hours
- **Risk identification** before acquisition closes

---

## Use Case 4: Architecture Drift Detection

### Problem

Software architecture degrades over time as teams take shortcuts. Without continuous monitoring, systems become unmaintainable and inconsistent with design intentions.

### Solution

Continuous architecture monitoring with drift detection.

### Implementation

```python
class ArchitectureDriftDetection:
    def __init__(self, nexus_client):
        self.reposwarm = nexus_client.plugin("nexus-reposwarm")

    async def establish_baseline(self, repo_url: str, architecture_rules: dict = None):
        # Create baseline analysis
        baseline = await self.reposwarm.analyze(
            repo_url=repo_url,
            analysis_depth="deep",
            options={
                "detect_architecture": True,
                "extract_patterns": True,
                "map_dependencies": True,
                "identify_boundaries": True
            }
        )

        result = await self.wait_for_completion(baseline.analysis_id)

        # Define architecture rules if not provided
        if not architecture_rules:
            architecture_rules = await self.reposwarm.suggest_architecture_rules(
                analysis_id=baseline.analysis_id
            )

        # Save baseline
        saved_baseline = await self.reposwarm.baselines.create(
            analysis_id=baseline.analysis_id,
            name=f"Baseline {datetime.now().isoformat()}",
            architecture_rules=architecture_rules,
            set_as_current=True
        )

        return {
            "baseline_id": saved_baseline.baseline_id,
            "analysis_id": baseline.analysis_id,
            "architecture_pattern": result.architecture.pattern,
            "rules": architecture_rules,
            "components": result.architecture.components
        }

    async def check_for_drift(self, repo_url: str, baseline_id: str):
        # Run new analysis
        current = await self.reposwarm.analyze(
            repo_url=repo_url,
            analysis_depth="standard",
            options={
                "compare_to_baseline": baseline_id
            }
        )

        result = await self.wait_for_completion(current.analysis_id)

        # Get drift report
        drift_report = await self.reposwarm.compare(
            analysis_a=baseline_id,
            analysis_b=current.analysis_id,
            focus="architecture_drift"
        )

        return {
            "has_drift": drift_report.drift_detected,
            "drift_score": drift_report.drift_score,  # 0-100, higher = more drift
            "violations": drift_report.rule_violations,
            "new_dependencies": drift_report.new_dependencies,
            "removed_boundaries": drift_report.boundary_violations,
            "pattern_changes": drift_report.pattern_changes,
            "recommendations": drift_report.recommendations
        }

    async def setup_drift_monitoring(self, repo_url: str, baseline_id: str):
        monitor = await self.reposwarm.monitors.create(
            repo_url=repo_url,
            schedule="daily",
            analysis_depth="standard",
            baseline_id=baseline_id,
            drift_detection={
                "enabled": True,
                "threshold": 10,  # Alert if drift score > 10
                "check_rules": True,
                "check_boundaries": True,
                "check_dependencies": True
            },
            notifications={
                "on_drift_detected": {
                    "channels": ["slack", "email"],
                    "include_diff": True
                },
                "on_rule_violation": {
                    "channels": ["slack"],
                    "immediate": True
                }
            },
            auto_create_issues={
                "enabled": True,
                "labels": ["architecture", "tech-debt"],
                "assignees": ["architect-team"]
            }
        )

        return monitor

    async def generate_architecture_fitness_report(self, repo_url: str, baseline_id: str):
        report = await self.reposwarm.generate_fitness_report(
            repo_url=repo_url,
            baseline_id=baseline_id,
            include=[
                "drift_history",
                "rule_compliance",
                "dependency_health",
                "complexity_trends",
                "test_coverage_trends"
            ],
            period="last_90_days"
        )

        return {
            "fitness_score": report.overall_fitness,
            "trend": report.trend,  # improving, stable, degrading
            "metrics": report.metrics,
            "recommendations": report.recommendations
        }
```

### Business Impact

- **Prevent architecture erosion** before it becomes critical
- **Automated rule enforcement** for consistent design
- **Early warning system** for technical debt accumulation
- **Quantified architecture health** over time

---

## Use Case 5: Multi-Repository Organization Analysis

### Problem

Large organizations have dozens or hundreds of repositories. Understanding the overall technology landscape, finding duplicate code, and ensuring consistency is nearly impossible manually.

### Solution

Organization-wide repository analysis and portfolio management.

### Implementation

```typescript
class OrganizationAnalysis {
  private reposwarm;

  constructor(nexusClient: NexusClient) {
    this.reposwarm = nexusClient.plugin('nexus-reposwarm');
  }

  async analyzeOrganization(orgName: string, platform: 'github' | 'gitlab' | 'bitbucket') {
    // Discover all repositories
    const repos = await this.reposwarm.discoverRepositories({
      organization: orgName,
      platform,
      includeArchived: false,
      includePrivate: true,
      accessToken: process.env.GIT_ACCESS_TOKEN
    });

    console.log(`Found ${repos.length} repositories`);

    // Batch analyze (respecting rate limits)
    const batchAnalysis = await this.reposwarm.analyzeBatch({
      repositories: repos.map(r => ({
        url: r.url,
        branch: r.defaultBranch
      })),
      analysisDepth: 'standard',
      options: {
        detectArchitecture: true,
        detectPatterns: true,
        findDuplicates: true, // Cross-repo duplicate detection
        mapDependencies: true
      }
    });

    // Wait for batch completion
    let batchResult = await this.pollBatchCompletion(batchAnalysis.batchId);

    // Generate organization-wide insights
    const orgInsights = await this.reposwarm.generateOrgInsights({
      batchId: batchAnalysis.batchId,
      include: [
        'technology_landscape',
        'architecture_patterns',
        'code_duplication',
        'shared_dependencies',
        'security_posture',
        'technical_debt_distribution',
        'team_ownership'
      ]
    });

    return {
      batchId: batchAnalysis.batchId,
      repositoriesAnalyzed: repos.length,
      insights: {
        technologyStack: orgInsights.technologies,
        dominantPatterns: orgInsights.architecturePatterns,
        duplicateCode: orgInsights.duplicates,
        sharedLibraryOpportunities: orgInsights.sharedLibraryCandidates,
        securityOverview: orgInsights.securitySummary,
        technicalDebtTotal: orgInsights.totalTechnicalDebt,
        recommendations: orgInsights.organizationRecommendations
      }
    };
  }

  async findDuplicateCode(batchId: string) {
    const duplicates = await this.reposwarm.findCrossRepoDuplicates({
      batchId,
      minSimilarity: 0.8,
      minLines: 20,
      ignoreTests: true,
      ignoreVendor: true
    });

    return {
      totalDuplicateSets: duplicates.sets.length,
      estimatedWastedLines: duplicates.totalDuplicateLines,
      opportunities: duplicates.sets.map(set => ({
        files: set.files,
        similarity: set.similarity,
        lines: set.lineCount,
        recommendation: set.extractionRecommendation
      })),
      sharedLibraryProposal: duplicates.proposedSharedLibrary
    };
  }

  async generateTechnologyRadar(batchId: string) {
    const radar = await this.reposwarm.generateTechnologyRadar({
      batchId,
      categorize: ['adopt', 'trial', 'assess', 'hold'],
      include: [
        'frameworks',
        'languages',
        'databases',
        'infrastructure',
        'testing_tools',
        'build_tools'
      ]
    });

    return {
      radar: radar.visualization,
      recommendations: radar.recommendations,
      standardizationOpportunities: radar.standardization,
      deprecationCandidates: radar.deprecation
    };
  }

  async trackOrganizationHealth(orgName: string) {
    // Set up organization-wide monitoring
    const orgMonitor = await this.reposwarm.monitors.createOrgMonitor({
      organization: orgName,
      schedule: 'weekly',
      analysisDepth: 'standard',
      metrics: [
        'code_quality_score',
        'security_score',
        'technical_debt',
        'test_coverage',
        'documentation_score'
      ],
      notifications: {
        weeklyDigest: {
          channels: ['email'],
          recipients: ['engineering-leads@company.com']
        },
        criticalIssues: {
          channels: ['slack'],
          immediate: true
        }
      },
      dashboard: {
        enabled: true,
        public: false
      }
    });

    return {
      monitorId: orgMonitor.monitorId,
      dashboardUrl: orgMonitor.dashboardUrl,
      nextAnalysis: orgMonitor.nextScheduledRun
    };
  }
}
```

### Business Impact

- **Complete technology landscape** visibility
- **Identify code duplication** across repositories
- **Standardization opportunities** for cost reduction
- **Organization-wide security** posture assessment

---

## Integration with Nexus Ecosystem

| Plugin | Integration |
|--------|-------------|
| **GraphRAG** | Pattern learning and caching |
| **MageAgent** | Multi-agent analysis orchestration |
| **FileProcess** | Report generation and export |

---

## Next Steps

- [Architecture Overview](./ARCHITECTURE.md) - System design and AI pipeline
- [API Reference](./docs/api-reference/endpoints.md) - Complete endpoint docs
- [Support](https://discord.gg/adverant) - Discord community

