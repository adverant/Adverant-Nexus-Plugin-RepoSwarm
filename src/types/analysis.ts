/**
 * Analysis Types and Interfaces for RepoSwarm
 */

import { RepositoryType, TechStack, RepositoryInfo, RepositoryMetadata, DirectoryStructure } from './repository';

export type AnalysisStatus = 'queued' | 'cloning' | 'detecting' | 'analyzing' | 'synthesizing' | 'generating' | 'completed' | 'failed';
export type AnalysisDepth = 'quick' | 'standard' | 'deep';
export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type FindingType = 'architecture' | 'security' | 'performance' | 'documentation' | 'testing' | 'maintainability';

export interface AnalysisRequest {
  repoUrl: string;
  branch?: string;
  analysisDepth?: AnalysisDepth;
  includeSecurityScan?: boolean;
  force?: boolean;  // Bypass cache
  webhookUrl?: string;
}

export interface AnalysisOptions {
  depth: AnalysisDepth;
  includeSecurityScan: boolean;
  force: boolean;
  maxFiles?: number;
  excludePatterns?: string[];
  focusAreas?: FindingType[];
  customPrompts?: Record<string, string>;
}

export interface Analysis {
  id: string;
  userId: string;
  tenantId: string;

  // Repository info
  repoUrl: string;
  repoName: string;
  branch: string;
  commitHash?: string;

  // Configuration
  analysisDepth: AnalysisDepth;
  includeSecurity: boolean;
  forceReanalysis: boolean;

  // Status
  status: AnalysisStatus;
  progress: number;  // 0-100
  currentStep?: string;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;

  // Results
  result?: AnalysisResult;

  // Usage metrics (for billing)
  usage: AnalysisUsage;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalysisResult {
  // Type detection
  detectedType: RepositoryType;
  techStack: TechStack[];

  // Architecture
  architecture: ArchitectureAnalysis;

  // Findings from all agents
  findings: Finding[];

  // Security (if enabled)
  securityFindings?: SecurityFinding[];

  // Recommendations
  recommendations: Recommendation[];

  // Generated documentation
  archMd: string;  // The .arch.md content

  // Metadata
  repositoryInfo: RepositoryInfo;
  repositoryMetadata: RepositoryMetadata;
  directoryStructure: DirectoryStructure;

  // Repository context (for output generation)
  repoUrl?: string;
  branch?: string;
  commitHash?: string;
  analysisDepth?: AnalysisDepth;
  status?: AnalysisStatus;

  // Dependencies
  dependencies?: ExternalDependency[];

  // Usage metrics
  durationMs?: number;
  tokensConsumed?: number;
  agentsUsed?: number;
  filesAnalyzed?: number;
  cacheHit?: boolean;
}

export interface ArchitectureAnalysis {
  pattern: ArchitecturePattern;
  patternConfidence: number;
  confidence?: number;  // Alternative confidence field
  description?: string;

  // Structure
  layers: ArchitectureLayer[];
  components: Component[];
  dependencies: DependencyGraph;

  // API surface
  apis?: ApiEndpoint[];

  // Data models
  dataModels?: DataModel[];

  // Build & deploy
  buildSystem?: BuildSystem;
  deploymentConfig?: DeploymentConfig;
}

export type ArchitecturePattern =
  | 'monolith'
  | 'layered-monolith'
  | 'microservices'
  | 'serverless'
  | 'event-driven'
  | 'hexagonal'
  | 'clean-architecture'
  | 'mvc'
  | 'mvvm'
  | 'flux'
  | 'component-based'
  | 'plugin-based'
  | 'unknown';

export interface ArchitectureLayer {
  name: string;
  type: 'presentation' | 'application' | 'domain' | 'infrastructure' | 'data' | 'api' | 'ui' | 'shared';
  paths: string[];
  description?: string;
  responsibilities: string[];
  dependencies: string[];
  components?: Component[];
}

export interface Component {
  name: string;
  type: 'service' | 'controller' | 'repository' | 'model' | 'utility' | 'middleware' | 'component' | 'module' | 'package';
  path: string;
  description: string;
  responsibilities?: string[];
  dependencies: string[];
  exports: string[];
  linesOfCode?: number;
  complexity?: number;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  externalDependencies: ExternalDependency[];
}

export interface DependencyNode {
  id: string;
  name: string;
  type: 'internal' | 'external';
  path?: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'extends' | 'implements' | 'uses';
}

export interface ExternalDependency {
  name: string;
  version: string;
  type: 'production' | 'development' | 'optional';
  purpose?: string;
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
  path: string;
  description?: string;
  parameters?: ApiParameter[];
  requestBody?: string;
  responseType?: string;
  filePath: string;
  lineNumber?: number;
}

export interface ApiParameter {
  name: string;
  type: string;
  required: boolean;
  location: 'path' | 'query' | 'header' | 'body';
}

export interface DataModel {
  name: string;
  type: 'entity' | 'dto' | 'interface' | 'schema';
  path: string;
  fields: DataField[];
  relationships?: DataRelationship[];
}

export interface DataField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface DataRelationship {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  target: string;
  foreignKey?: string;
}

export interface BuildSystem {
  type: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'poetry' | 'cargo' | 'maven' | 'gradle' | 'go' | 'make';
  scripts: Record<string, string>;
  configFiles: string[];
}

export interface DeploymentConfig {
  type: 'docker' | 'kubernetes' | 'serverless' | 'traditional' | 'static';
  files: string[];
  environments?: string[];
  cicd?: string;
}

export interface Finding {
  id: string;
  agentType: string;
  findingType: FindingType;
  severity: FindingSeverity;
  title: string;
  description: string;
  location?: string;  // File path or component
  lineNumber?: number;
  recommendation?: string;
  metadata?: Record<string, unknown>;
}

export interface SecurityFinding extends Finding {
  findingType: 'security';
  cwe?: string;  // CWE ID
  owasp?: string;  // OWASP category
  cvss?: number;  // CVSS score
  affectedVersions?: string[];
  remediation: string;
}

export interface Recommendation {
  category: 'architecture' | 'security' | 'performance' | 'maintainability' | 'testing' | 'documentation';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  relatedFindings?: string[];  // Finding IDs
}

export interface AnalysisUsage {
  tokensConsumed: number;
  inputTokens: number;
  outputTokens: number;
  agentsUsed: number;
  filesAnalyzed: number;
  repoSizeBytes: number;
  durationMs: number;
  cacheHit: boolean;
}

export interface AnalysisProgress {
  analysisId: string;
  status: AnalysisStatus;
  progress: number;
  currentStep: string;
  stepDetails?: string;
  estimatedTimeRemaining?: number;
}

export interface AnalysisEvent {
  type: 'started' | 'progress' | 'completed' | 'failed';
  analysisId: string;
  timestamp: Date;
  data: AnalysisProgress | AnalysisResult | { error: string };
}

export interface BatchAnalysisRequest {
  repositories: Array<{
    url: string;
    branch?: string;
  }>;
  options?: Partial<AnalysisOptions>;
}

export interface BatchAnalysisResult {
  batchId: string;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  analyses: Array<{
    repoUrl: string;
    analysisId: string;
    status: AnalysisStatus;
    error?: string;
  }>;
}

export interface AnalysisCompareResult {
  fromAnalysisId: string;
  toAnalysisId: string;

  // Changes
  addedFiles: string[];
  removedFiles: string[];
  modifiedFiles: string[];

  // Architecture changes
  architectureChanges: {
    patternChange?: { from: ArchitecturePattern; to: ArchitecturePattern };
    addedComponents: Component[];
    removedComponents: Component[];
    changedComponents: Array<{ name: string; changes: string[] }>;
  };

  // Dependency changes
  dependencyChanges: {
    added: ExternalDependency[];
    removed: ExternalDependency[];
    updated: Array<{ name: string; from: string; to: string }>;
  };

  // New findings
  newFindings: Finding[];
  resolvedFindings: Finding[];

  // Summary
  summary: string;
  significance: 'minor' | 'moderate' | 'major' | 'breaking';
}

export interface AnalysisCache {
  repoUrl: string;
  commitHash: string;
  analysisVersion: string;
  result: AnalysisResult;
  createdAt: Date;
  expiresAt: Date;
}

export type ExportFormat = 'markdown' | 'pdf' | 'html' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  includeFindings?: boolean;
  includeRecommendations?: boolean;
  includeCodeSnippets?: boolean;
  includeSections?: string[];
  theme?: 'light' | 'dark';
}

export interface ExportResult {
  format: ExportOptions['format'];
  content: string | Buffer;
  filename: string;
  mimeType: string;
}
