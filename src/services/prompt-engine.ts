/**
 * Prompt Engine for RepoSwarm
 * Manages domain-specific prompts for repository analysis
 */

import {
  PromptConfig,
  PromptContext,
  PromptResult,
  PromptChain,
  DEFAULT_PROMPTS,
  TYPE_SPECIFIC_PROMPTS,
  FindingType,
  RepositoryType,
  TenantContext,
  TechStack,
} from '../types';

interface PromptExecutionOptions {
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

interface RenderedPrompt {
  promptId: string;
  content: string;
  variables: Record<string, unknown>;
  outputFormat: 'markdown' | 'json' | 'structured';
}

export class PromptEngine {
  private tenantContext?: TenantContext;
  private promptCache: Map<string, PromptConfig[]> = new Map();
  private executionResults: Map<string, PromptResult> = new Map();

  constructor(tenantContext?: TenantContext) {
    this.tenantContext = tenantContext;
    this.initializePromptCache();
  }

  /**
   * Initialize prompt cache with default and type-specific prompts
   */
  private initializePromptCache(): void {
    // Cache default prompts by category
    for (const [category, prompts] of Object.entries(DEFAULT_PROMPTS)) {
      this.promptCache.set(`default:${category}`, prompts);
    }

    // Cache type-specific prompts
    for (const [repoType, categories] of Object.entries(TYPE_SPECIFIC_PROMPTS)) {
      for (const [category, prompts] of Object.entries(categories || {})) {
        this.promptCache.set(`${repoType}:${category}`, prompts as PromptConfig[]);
      }
    }
  }

  /**
   * Get prompts for a specific repository type and category
   */
  getPrompts(repoType: RepositoryType, category: FindingType): PromptConfig[] {
    // First, get default prompts for the category
    const defaultPrompts = this.promptCache.get(`default:${category}`) || [];

    // Then, get type-specific prompts that override or extend
    const typeSpecificPrompts = this.promptCache.get(`${repoType}:${category}`) || [];

    // Merge prompts, with type-specific taking precedence by ID
    const promptMap = new Map<string, PromptConfig>();

    for (const prompt of defaultPrompts) {
      if (prompt.targetType === 'all' || prompt.targetType === repoType) {
        promptMap.set(prompt.id, prompt);
      }
    }

    for (const prompt of typeSpecificPrompts) {
      promptMap.set(prompt.id, prompt);
    }

    // Sort by order
    return Array.from(promptMap.values()).sort((a, b) => a.order - b.order);
  }

  /**
   * Build a prompt chain for comprehensive analysis
   */
  buildPromptChain(repoType: RepositoryType, categories: FindingType[]): PromptChain {
    const allPrompts: PromptConfig[] = [];

    for (const category of categories) {
      const prompts = this.getPrompts(repoType, category);
      allPrompts.push(...prompts);
    }

    // Resolve dependencies and order
    const orderedPrompts = this.resolvePromptDependencies(allPrompts);

    return {
      id: `chain-${Date.now()}`,
      name: `Analysis chain for ${repoType}`,
      description: `Comprehensive analysis covering: ${categories.join(', ')}`,
      targetType: repoType,
      prompts: orderedPrompts,
    };
  }

  /**
   * Resolve prompt dependencies and return ordered list
   */
  private resolvePromptDependencies(prompts: PromptConfig[]): PromptConfig[] {
    const resolved: PromptConfig[] = [];
    const pending = new Set(prompts.map((p) => p.id));
    const promptMap = new Map(prompts.map((p) => [p.id, p]));

    const resolve = (promptId: string, visited: Set<string> = new Set()): void => {
      if (!pending.has(promptId)) return;
      if (visited.has(promptId)) {
        console.warn(`Circular dependency detected for prompt: ${promptId}`);
        return;
      }

      const prompt = promptMap.get(promptId);
      if (!prompt) return;

      visited.add(promptId);

      // Resolve dependencies first
      for (const depId of prompt.contextRequired) {
        if (promptMap.has(depId)) {
          resolve(depId, visited);
        }
      }

      pending.delete(promptId);
      resolved.push(prompt);
    };

    // Resolve all prompts
    for (const prompt of prompts) {
      resolve(prompt.id);
    }

    return resolved;
  }

  /**
   * Render a prompt template with context
   */
  renderPrompt(prompt: PromptConfig, context: PromptContext): RenderedPrompt {
    let content = prompt.template;
    const usedVariables: Record<string, unknown> = {};

    // Replace template variables
    for (const variable of prompt.variables) {
      const value = this.resolveVariable(variable.name, context);
      const placeholder = `{{${variable.name}}}`;

      if (content.includes(placeholder)) {
        const rendered = this.formatValue(value, variable.type);
        content = content.replace(new RegExp(placeholder, 'g'), rendered);
        usedVariables[variable.name] = value;
      }
    }

    // Handle nested variable references (e.g., {{previousContext.arch-overview}})
    const nestedRegex = /\{\{previousContext\.([a-z-]+)\}\}/gi;
    content = content.replace(nestedRegex, (match, promptId) => {
      const previousResult = context.previousContext[promptId];
      if (previousResult) {
        usedVariables[`previousContext.${promptId}`] = previousResult;
        return previousResult;
      }
      return `[No previous context for ${promptId}]`;
    });

    return {
      promptId: prompt.id,
      content,
      variables: usedVariables,
      outputFormat: prompt.outputFormat,
    };
  }

  /**
   * Resolve a variable from context
   */
  private resolveVariable(name: string, context: PromptContext): unknown {
    // Handle direct properties
    if (name in context) {
      return (context as unknown as Record<string, unknown>)[name];
    }

    // Handle special variable types
    switch (name) {
      case 'sourceFiles':
        return context.fileContents;
      case 'configFiles':
        return context.configFiles;
      case 'packageFiles':
        return this.extractPackageFiles(context);
      case 'lockFiles':
        return this.extractLockFiles(context);
      case 'testFiles':
        return this.extractTestFiles(context);
      case 'routeFiles':
        return this.extractRouteFiles(context);
      case 'componentFiles':
        return this.extractComponentFiles(context);
      case 'stateFiles':
        return this.extractStateFiles(context);
      case 'readme':
        return context.fileContents['README.md'] || context.fileContents['readme.md'] || '';
      case 'docs':
        return this.extractDocsFiles(context);
      case 'codeComments':
        return this.extractCodeComments(context);
      case 'testConfig':
        return this.extractTestConfig(context);
      case 'apiSpec':
        return this.extractApiSpec(context);
      default:
        return null;
    }
  }

  /**
   * Format a value based on its type
   */
  private formatValue(value: unknown, type: string): string {
    if (value === null || value === undefined) {
      return '[Not available]';
    }

    switch (type) {
      case 'string':
        return String(value);

      case 'array':
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return String(value);

      case 'object':
        if (typeof value === 'object') {
          return this.formatObjectAsMarkdown(value as Record<string, unknown>);
        }
        return String(value);

      case 'file_content':
        return String(value);

      case 'directory_structure':
        return String(value);

      default:
        return String(value);
    }
  }

  /**
   * Format an object as markdown
   */
  private formatObjectAsMarkdown(obj: Record<string, unknown>): string {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        lines.push(`### ${key}\n\`\`\`\n${value}\n\`\`\``);
      } else if (typeof value === 'object') {
        lines.push(`### ${key}\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``);
      } else {
        lines.push(`### ${key}\n${value}`);
      }
    }

    return lines.join('\n\n');
  }

  /**
   * Extract package manager files from context
   */
  private extractPackageFiles(context: PromptContext): Record<string, string> {
    const packageFiles: Record<string, string> = {};
    const patterns = [
      'package.json',
      'requirements.txt',
      'Pipfile',
      'pyproject.toml',
      'go.mod',
      'Cargo.toml',
      'pom.xml',
      'build.gradle',
      'Gemfile',
      'composer.json',
    ];

    for (const [path, content] of Object.entries(context.fileContents)) {
      const fileName = path.split('/').pop() || '';
      if (patterns.includes(fileName)) {
        packageFiles[path] = content;
      }
    }

    return packageFiles;
  }

  /**
   * Extract lock files from context
   */
  private extractLockFiles(context: PromptContext): Record<string, string> {
    const lockFiles: Record<string, string> = {};
    const patterns = [
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'Pipfile.lock',
      'poetry.lock',
      'go.sum',
      'Cargo.lock',
      'Gemfile.lock',
      'composer.lock',
    ];

    for (const [path, content] of Object.entries(context.fileContents)) {
      const fileName = path.split('/').pop() || '';
      if (patterns.includes(fileName)) {
        lockFiles[path] = content;
      }
    }

    return lockFiles;
  }

  /**
   * Extract test files from context
   */
  private extractTestFiles(context: PromptContext): Record<string, string> {
    const testFiles: Record<string, string> = {};
    const testPatterns = [
      /\.test\.[jt]sx?$/,
      /\.spec\.[jt]sx?$/,
      /_test\.go$/,
      /_test\.py$/,
      /test_.*\.py$/,
      /Test\.java$/,
      /\.test\.rs$/,
    ];

    for (const [path, content] of Object.entries(context.fileContents)) {
      if (testPatterns.some((p) => p.test(path))) {
        testFiles[path] = content;
      }
    }

    return testFiles;
  }

  /**
   * Extract route/controller files from context
   */
  private extractRouteFiles(context: PromptContext): Record<string, string> {
    const routeFiles: Record<string, string> = {};
    const patterns = [
      /routes?\//i,
      /controllers?\//i,
      /handlers?\//i,
      /api\//i,
      /endpoints?\//i,
    ];

    for (const [path, content] of Object.entries(context.fileContents)) {
      if (patterns.some((p) => p.test(path))) {
        routeFiles[path] = content;
      }
    }

    return routeFiles;
  }

  /**
   * Extract React/Vue/Angular component files
   */
  private extractComponentFiles(context: PromptContext): Record<string, string> {
    const componentFiles: Record<string, string> = {};
    const patterns = [
      /components?\//i,
      /\.vue$/,
      /\.tsx$/,
      /\.component\.ts$/,
    ];

    for (const [path, content] of Object.entries(context.fileContents)) {
      if (patterns.some((p) => p.test(path))) {
        componentFiles[path] = content;
      }
    }

    return componentFiles;
  }

  /**
   * Extract state management files
   */
  private extractStateFiles(context: PromptContext): Record<string, string> {
    const stateFiles: Record<string, string> = {};
    const patterns = [
      /store\//i,
      /redux/i,
      /context/i,
      /state/i,
      /vuex/i,
      /pinia/i,
      /zustand/i,
      /recoil/i,
      /jotai/i,
    ];

    for (const [path, content] of Object.entries(context.fileContents)) {
      if (patterns.some((p) => p.test(path))) {
        stateFiles[path] = content;
      }
    }

    return stateFiles;
  }

  /**
   * Extract documentation files
   */
  private extractDocsFiles(context: PromptContext): Record<string, string> {
    const docsFiles: Record<string, string> = {};
    const patterns = [
      /docs?\//i,
      /\.md$/,
      /documentation\//i,
      /wiki\//i,
    ];

    for (const [path, content] of Object.entries(context.fileContents)) {
      if (patterns.some((p) => p.test(path))) {
        docsFiles[path] = content;
      }
    }

    return docsFiles;
  }

  /**
   * Extract code comments sample
   */
  private extractCodeComments(context: PromptContext): Record<string, string> {
    const samples: Record<string, string> = {};
    const sourcePatterns = [/\.[jt]sx?$/, /\.py$/, /\.go$/, /\.java$/, /\.rs$/];

    let count = 0;
    const maxSamples = 5;

    for (const [path, content] of Object.entries(context.fileContents)) {
      if (count >= maxSamples) break;
      if (sourcePatterns.some((p) => p.test(path))) {
        // Extract first 100 lines with comments
        const lines = content.split('\n').slice(0, 100);
        const hasComments = lines.some(
          (line) =>
            line.includes('//') ||
            line.includes('/*') ||
            line.includes('#') ||
            line.includes('"""') ||
            line.includes("'''")
        );
        if (hasComments) {
          samples[path] = lines.join('\n');
          count++;
        }
      }
    }

    return samples;
  }

  /**
   * Extract test configuration files
   */
  private extractTestConfig(context: PromptContext): Record<string, string> {
    const configFiles: Record<string, string> = {};
    const patterns = [
      'jest.config.js',
      'jest.config.ts',
      'vitest.config.ts',
      'karma.conf.js',
      'pytest.ini',
      'setup.cfg',
      'tox.ini',
      '.mocharc.json',
      'ava.config.js',
    ];

    for (const [path, content] of Object.entries(context.fileContents)) {
      const fileName = path.split('/').pop() || '';
      if (patterns.includes(fileName)) {
        configFiles[path] = content;
      }
    }

    return configFiles;
  }

  /**
   * Extract API specification files
   */
  private extractApiSpec(context: PromptContext): string {
    const apiSpecPatterns = [
      'openapi.yaml',
      'openapi.json',
      'swagger.yaml',
      'swagger.json',
      'api.yaml',
      'api.json',
    ];

    for (const [path, content] of Object.entries(context.fileContents)) {
      const fileName = path.split('/').pop() || '';
      if (apiSpecPatterns.includes(fileName)) {
        return content;
      }
    }

    return '';
  }

  /**
   * Store execution result for context chaining
   */
  storeResult(promptId: string, result: PromptResult): void {
    this.executionResults.set(promptId, result);
  }

  /**
   * Get previous execution result
   */
  getResult(promptId: string): PromptResult | undefined {
    return this.executionResults.get(promptId);
  }

  /**
   * Build context for prompt execution
   */
  buildContext(
    repoInfo: {
      repoUrl: string;
      repoName: string;
      branch: string;
      commitHash: string;
      repoType: RepositoryType;
      techStack: TechStack[];
    },
    directoryStructure: string,
    fileList: string[],
    fileContents: Record<string, string>,
    configFiles: Record<string, string>
  ): PromptContext {
    // Build previous context from execution results
    const previousContext: Record<string, string> = {};
    for (const [promptId, result] of this.executionResults.entries()) {
      if (result.success) {
        previousContext[promptId] = result.output;
      }
    }

    return {
      repoUrl: repoInfo.repoUrl,
      repoName: repoInfo.repoName,
      branch: repoInfo.branch,
      commitHash: repoInfo.commitHash,
      repoType: repoInfo.repoType,
      techStack: repoInfo.techStack,
      directoryStructure,
      fileList,
      fileContents,
      previousContext,
      configFiles,
    };
  }

  /**
   * Parse JSON output from prompt result
   */
  parseJsonOutput<T>(output: string): T | null {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim()) as T;
      }

      // Try direct JSON parse
      return JSON.parse(output) as T;
    } catch (error) {
      console.error('Failed to parse JSON output:', error);
      return null;
    }
  }

  /**
   * Clear execution results (for new analysis)
   */
  clearResults(): void {
    this.executionResults.clear();
  }

  /**
   * Get all available categories for a repository type
   */
  getAvailableCategories(repoType: RepositoryType): FindingType[] {
    const categories: FindingType[] = [
      'architecture',
      'security',
      'performance',
      'documentation',
      'testing',
      'maintainability',
    ];

    return categories.filter((category) => {
      const prompts = this.getPrompts(repoType, category);
      return prompts.length > 0;
    });
  }

  /**
   * Get prompt execution options based on category
   */
  getExecutionOptions(category: FindingType): PromptExecutionOptions {
    const baseOptions: PromptExecutionOptions = {
      maxTokens: 4096,
      temperature: 0.3,
      timeout: 60000,
    };

    switch (category) {
      case 'architecture':
        return { ...baseOptions, maxTokens: 8192, timeout: 120000 };
      case 'security':
        return { ...baseOptions, maxTokens: 8192, temperature: 0.1 };
      case 'performance':
        return { ...baseOptions, maxTokens: 4096 };
      case 'documentation':
        return { ...baseOptions, maxTokens: 4096 };
      case 'testing':
        return { ...baseOptions, maxTokens: 4096 };
      case 'maintainability':
        return { ...baseOptions, maxTokens: 8192 };
      default:
        return baseOptions;
    }
  }

  /**
   * Set tenant context
   */
  setTenantContext(context: TenantContext): void {
    this.tenantContext = context;
  }
}

export default PromptEngine;
