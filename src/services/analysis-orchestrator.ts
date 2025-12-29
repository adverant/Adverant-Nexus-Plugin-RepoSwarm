/**
 * Analysis Orchestrator Service
 * Coordinates multi-agent repository analysis using MageAgent integration
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

import {
  Analysis,
  AnalysisRequest,
  AnalysisOptions,
  AnalysisResult,
  AnalysisStatus,
  AnalysisProgress,
  AnalysisUsage,
  ArchitectureAnalysis,
  Finding,
  SecurityFinding,
  Recommendation,
  TenantContext,
  DirectoryStructure,
  TypeDetectionResult,
  RepositoryInfo,
  RepositoryMetadata,
  PromptConfig,
  PromptContext,
  FindingType,
} from '../types';
import { RepoManager } from './repo-manager';
import { TypeDetector } from './type-detector';
import { CacheService } from './cache-service';
import { OutputGenerator } from './output-generator';
import { PromptEngine } from './prompt-engine';

const MAGEAGENT_URL = process.env.MAGEAGENT_URL || 'http://nexus-mageagent:9010';

interface AgentTask {
  id: string;
  type: 'architecture' | 'security' | 'performance' | 'documentation' | 'testing';
  prompt: string;
  priority: number;
  dependencies: string[];
}

interface AgentResult {
  taskId: string;
  type: string;
  success: boolean;
  output: unknown;
  tokensUsed: number;
  duration: number;
  error?: string;
}

export class AnalysisOrchestrator extends EventEmitter {
  private repoManager: RepoManager;
  private typeDetector: TypeDetector;
  private cacheService: CacheService;
  private outputGenerator: OutputGenerator;
  private promptEngine: PromptEngine;
  private activeAnalyses: Map<string, Analysis>;

  constructor(
    repoManager: RepoManager,
    cacheService: CacheService,
    outputGenerator: OutputGenerator,
    promptEngine: PromptEngine
  ) {
    super();
    this.repoManager = repoManager;
    this.typeDetector = new TypeDetector(repoManager);
    this.cacheService = cacheService;
    this.outputGenerator = outputGenerator;
    this.promptEngine = promptEngine;
    this.activeAnalyses = new Map();
  }

  /**
   * Start a new repository analysis
   */
  async startAnalysis(
    request: AnalysisRequest,
    tenantContext: TenantContext
  ): Promise<Analysis> {
    const analysisId = uuidv4();
    const parseResult = this.repoManager.parseRepoUrl(request.repoUrl);

    if (!parseResult.isValid) {
      throw new Error(`Invalid repository URL: ${parseResult.error}`);
    }

    const analysis: Analysis = {
      id: analysisId,
      userId: tenantContext.userId,
      tenantId: tenantContext.tenantId,
      repoUrl: request.repoUrl,
      repoName: `${parseResult.owner}/${parseResult.name}`,
      branch: request.branch || 'main',
      analysisDepth: request.analysisDepth || 'standard',
      includeSecurity: request.includeSecurityScan !== false,
      forceReanalysis: request.force || false,
      status: 'queued',
      progress: 0,
      usage: {
        tokensConsumed: 0,
        inputTokens: 0,
        outputTokens: 0,
        agentsUsed: 0,
        filesAnalyzed: 0,
        repoSizeBytes: 0,
        durationMs: 0,
        cacheHit: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.activeAnalyses.set(analysisId, analysis);

    // Emit initial event
    this.emitProgress(analysis);

    // Start analysis in background
    this.runAnalysis(analysis, request, tenantContext).catch((error) => {
      this.failAnalysis(analysis, error.message);
    });

    return analysis;
  }

  /**
   * Get analysis status
   */
  getAnalysis(analysisId: string): Analysis | undefined {
    return this.activeAnalyses.get(analysisId);
  }

  /**
   * Run the analysis pipeline
   */
  private async runAnalysis(
    analysis: Analysis,
    request: AnalysisRequest,
    tenantContext: TenantContext
  ): Promise<void> {
    const startTime = Date.now();
    let localPath: string | null = null;

    try {
      // Check cache first (unless force reanalysis)
      if (!request.force) {
        const cached = await this.cacheService.get(request.repoUrl, request.branch);
        if (cached) {
          analysis.status = 'completed';
          analysis.progress = 100;
          analysis.result = cached.result;
          analysis.usage.cacheHit = true;
          analysis.usage.durationMs = Date.now() - startTime;
          analysis.completedAt = new Date();
          this.emitProgress(analysis);
          return;
        }
      }

      // Step 1: Clone repository
      this.updateStatus(analysis, 'cloning', 10, 'Cloning repository...');
      const cloneResult = await this.repoManager.cloneRepository(
        request.repoUrl,
        { branch: request.branch }
      );

      if (!cloneResult.success) {
        throw new Error(`Failed to clone repository: ${cloneResult.error}`);
      }

      localPath = cloneResult.localPath;
      analysis.commitHash = cloneResult.commitHash;
      analysis.branch = cloneResult.branch;

      // Step 2: Detect repository type
      this.updateStatus(analysis, 'detecting', 20, 'Analyzing project structure...');

      const directoryStructure = await this.repoManager.getDirectoryStructure(localPath);
      const files = await this.repoManager.getFiles(localPath);
      const metadata = await this.repoManager.getRepositoryMetadata(localPath);

      const typeResult = await this.typeDetector.detect(localPath, directoryStructure, files);

      analysis.usage.filesAnalyzed = files.length;
      analysis.usage.repoSizeBytes = metadata.sizeBytes;

      // Step 3: Run multi-agent analysis
      this.updateStatus(analysis, 'analyzing', 30, 'Running AI analysis...');

      const options: AnalysisOptions = {
        depth: analysis.analysisDepth,
        includeSecurityScan: analysis.includeSecurity,
        force: analysis.forceReanalysis,
      };

      const agentResults = await this.runAgents(
        analysis,
        localPath,
        typeResult,
        directoryStructure,
        files,
        options,
        tenantContext
      );

      // Step 4: Synthesize results
      this.updateStatus(analysis, 'synthesizing', 80, 'Synthesizing findings...');

      const synthesizedResult = await this.synthesizeResults(
        analysis,
        typeResult,
        directoryStructure,
        metadata,
        agentResults,
        tenantContext
      );

      // Step 5: Generate documentation
      this.updateStatus(analysis, 'generating', 90, 'Generating documentation...');

      const archMd = this.outputGenerator.generateMarkdown(synthesizedResult, { format: 'markdown' });
      synthesizedResult.archMd = archMd;

      // Store repository info
      synthesizedResult.repositoryInfo = {
        url: request.repoUrl,
        platform: this.repoManager.parseRepoUrl(request.repoUrl).platform!,
        owner: this.repoManager.parseRepoUrl(request.repoUrl).owner!,
        name: this.repoManager.parseRepoUrl(request.repoUrl).name!,
        branch: analysis.branch,
        commitHash: analysis.commitHash,
      };
      synthesizedResult.repositoryMetadata = metadata;
      synthesizedResult.directoryStructure = directoryStructure;

      // Complete analysis
      analysis.status = 'completed';
      analysis.progress = 100;
      analysis.result = synthesizedResult;
      analysis.usage.durationMs = Date.now() - startTime;
      analysis.completedAt = new Date();
      analysis.updatedAt = new Date();

      // Cache result
      await this.cacheService.set(
        request.repoUrl,
        analysis.branch,
        cloneResult.commitHash,
        synthesizedResult
      );

      this.emitProgress(analysis);

      // Call webhook if configured
      if (request.webhookUrl) {
        await this.callWebhook(request.webhookUrl, {
          event: 'analysis.completed',
          analysisId: analysis.id,
          result: synthesizedResult,
        });
      }
    } catch (error) {
      this.failAnalysis(
        analysis,
        error instanceof Error ? error.message : 'Unknown error'
      );

      if (request.webhookUrl) {
        await this.callWebhook(request.webhookUrl, {
          event: 'analysis.failed',
          analysisId: analysis.id,
          error: analysis.errorMessage,
        });
      }
    } finally {
      // Cleanup
      if (localPath) {
        await this.repoManager.cleanup(localPath);
      }
    }
  }

  /**
   * Run multi-agent analysis
   */
  private async runAgents(
    analysis: Analysis,
    localPath: string,
    typeResult: TypeDetectionResult,
    structure: DirectoryStructure,
    files: { path: string; name: string; extension: string; size: number }[],
    options: AnalysisOptions,
    tenantContext: TenantContext
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    // Read relevant files for analysis
    const sourceFiles = await this.selectFilesForAnalysis(localPath, files, options.depth);
    const fileContents = await this.repoManager.readFiles(localPath, sourceFiles);

    // Build context for prompts
    const context: PromptContext = {
      repoUrl: analysis.repoUrl,
      repoName: analysis.repoName,
      branch: analysis.branch,
      commitHash: analysis.commitHash || '',
      repoType: typeResult.primaryType,
      techStack: typeResult.techStack,
      directoryStructure: this.formatStructure(structure),
      fileList: files.map((f) => f.path),
      fileContents,
      configFiles: await this.getConfigFiles(localPath),
      previousContext: {} as Record<string, string>,
    };

    // Get available categories for this repo type
    const categories: FindingType[] = ['architecture', 'security', 'performance', 'documentation', 'testing', 'maintainability'];

    let progressBase = 30;
    const progressPerCategory = 50 / categories.length;

    for (const category of categories) {
      if (category === 'security' && !options.includeSecurityScan) {
        continue;
      }

      // Get prompts for this category and repo type
      const categoryPrompts = this.promptEngine.getPrompts(typeResult.primaryType, category);
      if (categoryPrompts.length === 0) continue;

      this.updateStatus(
        analysis,
        'analyzing',
        progressBase,
        `Analyzing ${category}...`
      );

      for (const prompt of categoryPrompts.sort((a: PromptConfig, b: PromptConfig) => a.order - b.order)) {
        try {
          const renderedPrompt = this.promptEngine.renderPrompt(prompt, context);

          // Call MageAgent for analysis
          const result = await this.callMageAgent(
            prompt.id,
            category,
            renderedPrompt.content,
            tenantContext
          );

          // Update token usage
          analysis.usage.tokensConsumed += result.tokensUsed;
          analysis.usage.agentsUsed++;

          // Store result for context chaining
          if (result.success && result.output) {
            context.previousContext[prompt.id] = JSON.stringify(result.output);
          }

          results.push(result);
        } catch (error) {
          results.push({
            taskId: prompt.id,
            type: category,
            success: false,
            output: null,
            tokensUsed: 0,
            duration: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      progressBase += progressPerCategory;
    }

    return results;
  }

  /**
   * Call MageAgent service for analysis
   */
  private async callMageAgent(
    taskId: string,
    taskType: string,
    prompt: string,
    tenantContext: TenantContext
  ): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${MAGEAGENT_URL}/v1/orchestration/task`,
        {
          task: {
            id: taskId,
            type: 'analysis',
            objective: prompt,
            constraints: {
              maxTokens: 8000,
              timeout: 120000,
            },
          },
          options: {
            model: 'anthropic/claude-3.5-sonnet',
            streaming: false,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': tenantContext.tenantId,
            'X-User-Id': tenantContext.userId,
            'X-Request-Id': tenantContext.requestId || uuidv4(),
          },
          timeout: 120000,
        }
      );

      const duration = Date.now() - startTime;

      // Parse response
      const output = this.parseAgentOutput(response.data);

      return {
        taskId,
        type: taskType,
        success: true,
        output,
        tokensUsed: response.data.usage?.totalTokens || 0,
        duration,
      };
    } catch (error) {
      return {
        taskId,
        type: taskType,
        success: false,
        output: null,
        tokensUsed: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'MageAgent call failed',
      };
    }
  }

  /**
   * Parse agent output from response
   */
  private parseAgentOutput(response: unknown): unknown {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const data = response as Record<string, unknown>;

    // Try to extract content from various response formats
    if (data.result) return data.result;
    if (data.content) return data.content;
    if (data.output) return data.output;
    if (data.data) return data.data;

    return response;
  }

  /**
   * Synthesize results from all agents
   */
  private async synthesizeResults(
    analysis: Analysis,
    typeResult: TypeDetectionResult,
    structure: DirectoryStructure,
    metadata: RepositoryMetadata,
    agentResults: AgentResult[],
    tenantContext: TenantContext
  ): Promise<AnalysisResult> {
    const findings: Finding[] = [];
    const securityFindings: SecurityFinding[] = [];
    const recommendations: Recommendation[] = [];

    let architecture: ArchitectureAnalysis = {
      pattern: 'unknown',
      patternConfidence: 0,
      layers: [],
      components: [],
      dependencies: {
        nodes: [],
        edges: [],
        externalDependencies: [],
      },
    };

    // Process each agent result
    for (const result of agentResults) {
      if (!result.success || !result.output) continue;

      const output = result.output as Record<string, unknown>;

      switch (result.type) {
        case 'architecture':
          if (result.taskId === 'arch-overview') {
            architecture = this.parseArchitectureResult(output, architecture);
          } else if (result.taskId === 'arch-components') {
            architecture.components = this.parseComponents(output);
          } else if (result.taskId === 'arch-dependencies') {
            architecture.dependencies = this.parseDependencies(output);
          }
          break;

        case 'security':
          const secFindings = this.parseSecurityFindings(output, result.taskId);
          securityFindings.push(...secFindings);
          break;

        case 'performance':
        case 'documentation':
        case 'testing':
        case 'maintainability':
          const categoryFindings = this.parseFindings(output, result.type, result.taskId);
          findings.push(...categoryFindings);
          break;
      }

      // Extract recommendations from any result
      if (output.recommendations) {
        const recs = this.parseRecommendations(output.recommendations, result.type);
        recommendations.push(...recs);
      }
    }

    return {
      detectedType: typeResult.primaryType,
      techStack: typeResult.techStack,
      architecture,
      findings,
      securityFindings: analysis.includeSecurity ? securityFindings : undefined,
      recommendations,
      archMd: '', // Will be generated later
      repositoryInfo: {} as RepositoryInfo,
      repositoryMetadata: metadata,
      directoryStructure: structure,
    };
  }

  /**
   * Parse architecture analysis result
   */
  private parseArchitectureResult(
    output: Record<string, unknown>,
    current: ArchitectureAnalysis
  ): ArchitectureAnalysis {
    return {
      ...current,
      pattern: (output.pattern as ArchitectureAnalysis['pattern']) || current.pattern,
      patternConfidence: (output.confidence as number) || current.patternConfidence,
      layers: (output.layers as ArchitectureAnalysis['layers']) || current.layers,
    };
  }

  /**
   * Parse components from agent output
   */
  private parseComponents(output: Record<string, unknown>): ArchitectureAnalysis['components'] {
    const components = output.components as unknown[];
    if (!Array.isArray(components)) return [];

    return components.map((c) => {
      const comp = c as Record<string, unknown>;
      return {
        name: String(comp.name || ''),
        type: comp.type as ArchitectureAnalysis['components'][0]['type'] || 'module',
        path: String(comp.path || ''),
        description: String(comp.description || ''),
        dependencies: (comp.dependencies as string[]) || [],
        exports: (comp.exports as string[]) || [],
        linesOfCode: comp.linesOfCode as number,
        complexity: comp.complexity as number,
      };
    });
  }

  /**
   * Parse dependencies from agent output
   */
  private parseDependencies(output: Record<string, unknown>): ArchitectureAnalysis['dependencies'] {
    return {
      nodes: (output.nodes as ArchitectureAnalysis['dependencies']['nodes']) || [],
      edges: (output.edges as ArchitectureAnalysis['dependencies']['edges']) || [],
      externalDependencies: (output.externalDependencies as ArchitectureAnalysis['dependencies']['externalDependencies']) || [],
    };
  }

  /**
   * Parse security findings from agent output
   */
  private parseSecurityFindings(output: Record<string, unknown>, agentType: string): SecurityFinding[] {
    const findings = output.findings as unknown[] || output.vulnerabilities as unknown[] || [];
    if (!Array.isArray(findings)) return [];

    return findings.map((f) => {
      const finding = f as Record<string, unknown>;
      return {
        id: uuidv4(),
        agentType,
        findingType: 'security',
        severity: (finding.severity as SecurityFinding['severity']) || 'medium',
        title: String(finding.title || finding.name || ''),
        description: String(finding.description || ''),
        location: finding.location as string,
        lineNumber: finding.lineNumber as number,
        recommendation: String(finding.recommendation || finding.remediation || ''),
        cwe: finding.cwe as string,
        owasp: finding.owasp as string,
        cvss: finding.cvss as number,
        remediation: String(finding.remediation || finding.recommendation || ''),
      };
    });
  }

  /**
   * Parse general findings from agent output
   */
  private parseFindings(
    output: Record<string, unknown>,
    findingType: Finding['findingType'],
    agentType: string
  ): Finding[] {
    const findings = output.findings as unknown[] || output.issues as unknown[] || [];
    if (!Array.isArray(findings)) return [];

    return findings.map((f) => {
      const finding = f as Record<string, unknown>;
      return {
        id: uuidv4(),
        agentType,
        findingType,
        severity: (finding.severity as Finding['severity']) || 'info',
        title: String(finding.title || finding.name || ''),
        description: String(finding.description || ''),
        location: finding.location as string,
        lineNumber: finding.lineNumber as number,
        recommendation: finding.recommendation as string,
      };
    });
  }

  /**
   * Parse recommendations from agent output
   */
  private parseRecommendations(
    recs: unknown,
    category: string
  ): Recommendation[] {
    if (!Array.isArray(recs)) return [];

    return recs.map((r) => {
      const rec = r as Record<string, unknown>;
      return {
        category: category as Recommendation['category'],
        priority: (rec.priority as Recommendation['priority']) || 'medium',
        title: String(rec.title || ''),
        description: String(rec.description || ''),
        effort: (rec.effort as Recommendation['effort']) || 'medium',
        impact: (rec.impact as Recommendation['impact']) || 'medium',
      };
    });
  }

  /**
   * Select files for analysis based on depth
   */
  private async selectFilesForAnalysis(
    localPath: string,
    files: { path: string; extension: string; size: number }[],
    depth: 'quick' | 'standard' | 'deep'
  ): Promise<string[]> {
    const limits = {
      quick: 20,
      standard: 50,
      deep: 100,
    };

    const limit = limits[depth];

    // Prioritize important files
    const priorityExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java'];
    const priorityNames = ['index', 'main', 'app', 'server', 'api', 'routes', 'controller'];

    const scored = files
      .filter((f) => f.size < 500000) // Skip large files
      .map((f) => {
        let score = 0;

        // Extension priority
        if (priorityExtensions.includes(f.extension)) score += 10;

        // Name priority
        const baseName = f.path.split('/').pop()?.replace(/\.[^.]+$/, '').toLowerCase() || '';
        if (priorityNames.some((n) => baseName.includes(n))) score += 5;

        // Root level files get priority
        if (!f.path.includes('/')) score += 3;

        // Shorter paths preferred
        score -= f.path.split('/').length;

        return { ...f, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((f) => f.path);
  }

  /**
   * Get configuration files content
   */
  private async getConfigFiles(localPath: string): Promise<Record<string, string>> {
    const configPatterns = [
      'package.json',
      'tsconfig.json',
      'webpack.config.js',
      'vite.config.ts',
      'next.config.js',
      '.eslintrc.json',
      'requirements.txt',
      'go.mod',
      'Cargo.toml',
      'docker-compose.yml',
      'Dockerfile',
    ];

    const contents: Record<string, string> = {};

    for (const pattern of configPatterns) {
      const content = await this.repoManager.readFile(localPath, pattern);
      if (content) {
        contents[pattern] = content;
      }
    }

    return contents;
  }

  /**
   * Format directory structure for prompt
   */
  private formatStructure(structure: DirectoryStructure, depth = 0, maxDepth = 4): string {
    if (depth > maxDepth) return '';

    const indent = '  '.repeat(depth);
    let result = `${indent}${structure.name}${structure.type === 'directory' ? '/' : ''}\n`;

    if (structure.children && depth < maxDepth) {
      for (const child of structure.children.slice(0, 50)) { // Limit children
        result += this.formatStructure(child, depth + 1, maxDepth);
      }
    }

    return result;
  }

  /**
   * Update analysis status
   */
  private updateStatus(
    analysis: Analysis,
    status: AnalysisStatus,
    progress: number,
    step: string
  ): void {
    analysis.status = status;
    analysis.progress = progress;
    analysis.currentStep = step;
    analysis.updatedAt = new Date();
    this.emitProgress(analysis);
  }

  /**
   * Mark analysis as failed
   */
  private failAnalysis(analysis: Analysis, error: string): void {
    analysis.status = 'failed';
    analysis.errorMessage = error;
    analysis.updatedAt = new Date();
    this.emitProgress(analysis);
  }

  /**
   * Emit progress event
   */
  private emitProgress(analysis: Analysis): void {
    const progress: AnalysisProgress = {
      analysisId: analysis.id,
      status: analysis.status,
      progress: analysis.progress,
      currentStep: analysis.currentStep || '',
    };

    this.emit('progress', progress);
  }

  /**
   * Call webhook
   */
  private async callWebhook(url: string, payload: unknown): Promise<void> {
    try {
      await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
    } catch {
      // Ignore webhook errors
    }
  }
}

export default AnalysisOrchestrator;
