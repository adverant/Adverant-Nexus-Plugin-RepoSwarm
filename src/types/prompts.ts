/**
 * Prompt Types and Configurations for RepoSwarm
 */

import { RepositoryType, TechStack } from './repository';
import { FindingType } from './analysis';

export interface PromptConfig {
  id: string;
  name: string;
  description: string;
  targetType: RepositoryType | 'all';
  category: FindingType;
  order: number;  // Execution order within category
  template: string;
  variables: PromptVariable[];
  contextRequired: string[];  // IDs of prompts that must run before this
  outputFormat: 'markdown' | 'json' | 'structured';
}

export interface PromptVariable {
  name: string;
  description: string;
  type: 'string' | 'array' | 'object' | 'file_content' | 'directory_structure';
  required: boolean;
  default?: unknown;
}

export interface PromptContext {
  // Repository information
  repoUrl: string;
  repoName: string;
  branch: string;
  commitHash: string;
  repoType: RepositoryType;
  techStack: TechStack[];

  // Structure
  directoryStructure: string;
  fileList: string[];

  // File contents (key = path, value = content)
  fileContents: Record<string, string>;

  // Previous analysis results
  previousContext: Record<string, string>;

  // Configuration files
  configFiles: Record<string, string>;
}

export interface PromptResult {
  promptId: string;
  success: boolean;
  output: string;
  parsedOutput?: unknown;
  tokensUsed: number;
  durationMs: number;
  error?: string;
}

export interface PromptChain {
  id: string;
  name: string;
  description: string;
  targetType: RepositoryType;
  prompts: PromptConfig[];
}

/**
 * Default prompt templates by category
 */
export const DEFAULT_PROMPTS: Record<FindingType, PromptConfig[]> = {
  architecture: [
    {
      id: 'arch-overview',
      name: 'Architecture Overview',
      description: 'Analyze overall architecture pattern and structure',
      targetType: 'all',
      category: 'architecture',
      order: 1,
      template: `Analyze the following repository structure and identify the architecture pattern used.

Repository: {{repoName}}
Type: {{repoType}}
Tech Stack: {{techStack}}

Directory Structure:
{{directoryStructure}}

Key Configuration Files:
{{configFiles}}

Please provide:
1. The primary architecture pattern (monolith, microservices, layered, hexagonal, etc.)
2. Confidence level (0-100%)
3. Key architectural layers identified
4. Main components and their responsibilities
5. Any architectural concerns or anti-patterns observed

Respond in JSON format.`,
      variables: [
        { name: 'repoName', description: 'Repository name', type: 'string', required: true },
        { name: 'repoType', description: 'Repository type', type: 'string', required: true },
        { name: 'techStack', description: 'Detected tech stack', type: 'array', required: true },
        { name: 'directoryStructure', description: 'Directory structure', type: 'directory_structure', required: true },
        { name: 'configFiles', description: 'Configuration file contents', type: 'object', required: false },
      ],
      contextRequired: [],
      outputFormat: 'json',
    },
    {
      id: 'arch-components',
      name: 'Component Analysis',
      description: 'Identify and analyze individual components',
      targetType: 'all',
      category: 'architecture',
      order: 2,
      template: `Based on the architecture overview, analyze the individual components.

Previous Context:
{{previousContext.arch-overview}}

Source Files:
{{sourceFiles}}

For each component, provide:
1. Component name and type
2. Responsibilities
3. Dependencies (internal and external)
4. Public interface/exports
5. Coupling assessment

Respond in JSON format with an array of components.`,
      variables: [
        { name: 'sourceFiles', description: 'Source file contents', type: 'object', required: true },
      ],
      contextRequired: ['arch-overview'],
      outputFormat: 'json',
    },
    {
      id: 'arch-dependencies',
      name: 'Dependency Analysis',
      description: 'Map internal and external dependencies',
      targetType: 'all',
      category: 'architecture',
      order: 3,
      template: `Analyze the dependency graph of the repository.

Package Manager Files:
{{packageFiles}}

Source Files:
{{sourceFiles}}

Component Analysis:
{{previousContext.arch-components}}

Provide:
1. Internal dependency graph (which modules depend on which)
2. External dependencies with their purposes
3. Dependency health assessment (outdated, vulnerable, unnecessary)
4. Circular dependency detection

Respond in JSON format.`,
      variables: [
        { name: 'packageFiles', description: 'Package manager files', type: 'object', required: true },
        { name: 'sourceFiles', description: 'Source file imports', type: 'object', required: true },
      ],
      contextRequired: ['arch-components'],
      outputFormat: 'json',
    },
  ],

  security: [
    {
      id: 'security-secrets',
      name: 'Secrets Detection',
      description: 'Detect hardcoded secrets and credentials',
      targetType: 'all',
      category: 'security',
      order: 1,
      template: `Scan the following files for potential hardcoded secrets, credentials, and sensitive data.

Files to scan:
{{fileContents}}

Look for:
1. API keys and tokens
2. Passwords and connection strings
3. Private keys and certificates
4. Cloud credentials (AWS, GCP, Azure)
5. OAuth secrets
6. Environment variables that should be externalized

For each finding, provide:
- File path and line number
- Type of secret
- Severity (critical/high/medium/low)
- Recommendation for remediation

Respond in JSON format.`,
      variables: [
        { name: 'fileContents', description: 'File contents to scan', type: 'object', required: true },
      ],
      contextRequired: [],
      outputFormat: 'json',
    },
    {
      id: 'security-vulnerabilities',
      name: 'Vulnerability Analysis',
      description: 'Identify security vulnerabilities in code',
      targetType: 'all',
      category: 'security',
      order: 2,
      template: `Analyze the following code for security vulnerabilities.

Tech Stack: {{techStack}}

Source Files:
{{sourceFiles}}

Check for:
1. Injection vulnerabilities (SQL, NoSQL, Command, LDAP)
2. XSS vulnerabilities
3. CSRF issues
4. Authentication/Authorization flaws
5. Insecure cryptographic practices
6. Sensitive data exposure
7. Security misconfigurations
8. Insufficient logging

For each vulnerability:
- CWE ID if applicable
- OWASP category
- Severity and CVSS score estimate
- File location
- Code snippet
- Remediation steps

Respond in JSON format.`,
      variables: [
        { name: 'techStack', description: 'Detected tech stack', type: 'array', required: true },
        { name: 'sourceFiles', description: 'Source file contents', type: 'object', required: true },
      ],
      contextRequired: [],
      outputFormat: 'json',
    },
    {
      id: 'security-dependencies',
      name: 'Dependency Security',
      description: 'Check for vulnerable dependencies',
      targetType: 'all',
      category: 'security',
      order: 3,
      template: `Analyze dependencies for known security vulnerabilities.

Package Files:
{{packageFiles}}

Lock Files:
{{lockFiles}}

Identify:
1. Dependencies with known CVEs
2. Outdated packages with security patches available
3. Unmaintained dependencies
4. Dependencies from untrusted sources

For each issue:
- Package name and version
- CVE IDs if known
- Severity
- Recommended version or alternative

Respond in JSON format.`,
      variables: [
        { name: 'packageFiles', description: 'Package configuration files', type: 'object', required: true },
        { name: 'lockFiles', description: 'Lock files', type: 'object', required: false },
      ],
      contextRequired: [],
      outputFormat: 'json',
    },
  ],

  performance: [
    {
      id: 'perf-analysis',
      name: 'Performance Analysis',
      description: 'Identify performance bottlenecks and issues',
      targetType: 'all',
      category: 'performance',
      order: 1,
      template: `Analyze the following code for performance issues.

Tech Stack: {{techStack}}
Repository Type: {{repoType}}

Source Files:
{{sourceFiles}}

Look for:
1. N+1 query problems
2. Missing database indexes hints
3. Inefficient algorithms (O(n²) or worse)
4. Memory leaks potential
5. Blocking operations in async code
6. Excessive re-renders (for frontend)
7. Large bundle sizes concerns
8. Missing caching opportunities
9. Inefficient data structures

For each issue:
- Location and code snippet
- Impact assessment
- Optimization recommendation

Respond in JSON format.`,
      variables: [
        { name: 'techStack', description: 'Detected tech stack', type: 'array', required: true },
        { name: 'repoType', description: 'Repository type', type: 'string', required: true },
        { name: 'sourceFiles', description: 'Source file contents', type: 'object', required: true },
      ],
      contextRequired: [],
      outputFormat: 'json',
    },
  ],

  documentation: [
    {
      id: 'docs-analysis',
      name: 'Documentation Analysis',
      description: 'Assess documentation quality and completeness',
      targetType: 'all',
      category: 'documentation',
      order: 1,
      template: `Analyze the documentation quality of this repository.

README:
{{readme}}

Other Documentation:
{{docs}}

Code Comments (sample):
{{codeComments}}

Assess:
1. README completeness (installation, usage, configuration, contributing)
2. API documentation presence and quality
3. Code comment quality and coverage
4. Architecture documentation
5. Examples and tutorials
6. Changelog presence

Provide:
- Overall documentation score (0-100)
- Specific gaps and recommendations
- Priority improvements

Respond in JSON format.`,
      variables: [
        { name: 'readme', description: 'README content', type: 'file_content', required: false },
        { name: 'docs', description: 'Documentation files', type: 'object', required: false },
        { name: 'codeComments', description: 'Sample code with comments', type: 'object', required: false },
      ],
      contextRequired: [],
      outputFormat: 'json',
    },
  ],

  testing: [
    {
      id: 'test-analysis',
      name: 'Test Coverage Analysis',
      description: 'Analyze testing practices and coverage',
      targetType: 'all',
      category: 'testing',
      order: 1,
      template: `Analyze the testing setup and coverage.

Test Files:
{{testFiles}}

Source Files (for comparison):
{{sourceFiles}}

Test Configuration:
{{testConfig}}

Assess:
1. Test framework(s) used
2. Test types present (unit, integration, e2e)
3. Estimated coverage (based on test file presence)
4. Testing patterns and practices
5. Mock usage and quality
6. Critical paths without tests
7. Test naming conventions

Provide:
- Testing maturity score (0-100)
- Missing test coverage areas
- Recommendations for improvement

Respond in JSON format.`,
      variables: [
        { name: 'testFiles', description: 'Test file contents', type: 'object', required: true },
        { name: 'sourceFiles', description: 'Source file names for coverage estimation', type: 'array', required: true },
        { name: 'testConfig', description: 'Test configuration files', type: 'object', required: false },
      ],
      contextRequired: [],
      outputFormat: 'json',
    },
  ],

  maintainability: [
    {
      id: 'maintain-analysis',
      name: 'Maintainability Analysis',
      description: 'Assess code maintainability and technical debt',
      targetType: 'all',
      category: 'maintainability',
      order: 1,
      template: `Analyze code maintainability and technical debt.

Source Files:
{{sourceFiles}}

Architecture Overview:
{{previousContext.arch-overview}}

Assess:
1. Code complexity (cyclomatic complexity indicators)
2. Code duplication patterns
3. Naming conventions consistency
4. File organization
5. Error handling patterns
6. Technical debt indicators (TODOs, FIXMEs, deprecated code)
7. Code style consistency
8. Module cohesion

Provide:
- Maintainability score (0-100)
- Top 5 technical debt items
- Refactoring recommendations

Respond in JSON format.`,
      variables: [
        { name: 'sourceFiles', description: 'Source file contents', type: 'object', required: true },
      ],
      contextRequired: ['arch-overview'],
      outputFormat: 'json',
    },
  ],
};

/**
 * Repository type specific prompt overrides
 */
export const TYPE_SPECIFIC_PROMPTS: Partial<Record<RepositoryType, Partial<Record<FindingType, PromptConfig[]>>>> = {
  backend: {
    architecture: [
      {
        id: 'backend-api-design',
        name: 'API Design Analysis',
        description: 'Analyze REST/GraphQL API design',
        targetType: 'backend',
        category: 'architecture',
        order: 4,
        template: `Analyze the API design patterns in this backend service.

Route/Controller Files:
{{routeFiles}}

OpenAPI/Swagger (if available):
{{apiSpec}}

Assess:
1. RESTful design compliance
2. API versioning strategy
3. Error handling consistency
4. Authentication/Authorization patterns
5. Rate limiting implementation
6. Request validation
7. Response format consistency

Provide recommendations for API improvements.`,
        variables: [
          { name: 'routeFiles', description: 'Route and controller files', type: 'object', required: true },
          { name: 'apiSpec', description: 'OpenAPI specification', type: 'file_content', required: false },
        ],
        contextRequired: ['arch-overview'],
        outputFormat: 'json',
      },
    ],
  },

  frontend: {
    architecture: [
      {
        id: 'frontend-component-analysis',
        name: 'Component Architecture',
        description: 'Analyze React/Vue/Angular component patterns',
        targetType: 'frontend',
        category: 'architecture',
        order: 4,
        template: `Analyze the frontend component architecture.

Component Files:
{{componentFiles}}

State Management:
{{stateFiles}}

Assess:
1. Component hierarchy and composition
2. State management patterns
3. Props drilling issues
4. Render optimization (memo, useMemo, useCallback)
5. Component reusability
6. Styling approach consistency

Provide recommendations for component architecture improvements.`,
        variables: [
          { name: 'componentFiles', description: 'React/Vue/Angular component files', type: 'object', required: true },
          { name: 'stateFiles', description: 'State management files', type: 'object', required: false },
        ],
        contextRequired: ['arch-overview'],
        outputFormat: 'json',
      },
    ],
  },
};
