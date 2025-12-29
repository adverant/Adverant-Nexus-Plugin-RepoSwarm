# Contributing to RepoSwarm

Thank you for your interest in contributing to RepoSwarm! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

Before submitting a bug report:
1. Check the [existing issues](https://github.com/adverant/Adverant-Nexus-Plugin-RepoSwarm/issues) to avoid duplicates
2. Collect relevant information about your environment
3. Provide steps to reproduce the issue

**Bug Report Template:**
- **Description**: Clear description of the bug
- **Steps to Reproduce**: Numbered steps to reproduce
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: OS, Node.js version, etc.
- **Screenshots/Logs**: If applicable

### Suggesting Features

We welcome feature suggestions! Please:
1. Check existing [feature requests](https://github.com/adverant/Adverant-Nexus-Plugin-RepoSwarm/labels/enhancement)
2. Describe the problem your feature would solve
3. Propose a solution if you have one

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `npm install`
3. **Make your changes** following our coding standards
4. **Add tests** for new functionality
5. **Run tests**: `npm test`
6. **Run linting**: `npm run lint`
7. **Run type checking**: `npm run typecheck`
8. **Commit your changes** with a clear commit message
9. **Push to your fork** and submit a pull request

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

**Examples:**
```
feat(analysis): add support for GitLab repositories
fix(parser): handle edge case with empty directories
docs(readme): update installation instructions
```

## Development Setup

### Prerequisites

- Node.js 20+
- npm 9+
- Docker (for running integration tests)

### Local Development

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Adverant-Nexus-Plugin-RepoSwarm.git
cd Adverant-Nexus-Plugin-RepoSwarm

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Project Structure

```
src/
├── types/              # TypeScript interfaces
│   ├── repository.ts   # Repository types
│   ├── analysis.ts     # Analysis result types
│   └── prompts.ts      # Prompt configuration types
├── services/           # Business logic
│   ├── repo-manager.ts # Git operations
│   ├── type-detector.ts # Repo type detection
│   ├── analysis-orchestrator.ts # Multi-agent coordination
│   ├── prompt-engine.ts # Domain-specific prompts
│   ├── cache-service.ts # GraphRAG integration
│   └── output-generator.ts # .arch.md generation
├── routes/             # API endpoints
│   ├── analysis.ts     # Analysis routes
│   ├── monitoring.ts   # Monitor routes
│   └── webhooks.ts     # Webhook routes
├── workers/            # Background workers
│   └── monitor-worker.ts # Continuous monitoring
├── middleware/         # Express middleware
└── index.ts            # Entry point
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/services/type-detector.test.ts

# Run in watch mode
npm run test:watch
```

### Adding a New Repository Type

1. Add the type to `src/types/repository.ts`:
```typescript
export type RepositoryType =
  | 'backend'
  | 'frontend'
  | 'mobile'
  | 'infra-as-code'
  | 'library'
  | 'monorepo'
  | 'your-new-type';  // Add here
```

2. Add detection logic to `src/services/type-detector.ts`

3. Create prompts in `src/prompts/your-new-type/`

4. Add tests

### Adding a New Analysis Agent

1. Create agent in `src/agents/your-agent.ts`:
```typescript
export interface YourAgentConfig {
  // Configuration options
}

export class YourAgent {
  async analyze(context: AnalysisContext): Promise<AgentFindings> {
    // Implementation
  }
}
```

2. Register in `src/services/analysis-orchestrator.ts`

3. Add tests

## Coding Standards

### TypeScript Guidelines

- Use strict TypeScript configuration
- Avoid `any` type - use proper typing
- Use interfaces for object shapes
- Use enums for fixed sets of values
- Document public APIs with JSDoc comments

```typescript
/**
 * Analyzes a repository and returns findings.
 * @param repoUrl - The URL of the repository to analyze
 * @param options - Analysis options
 * @returns Analysis results
 */
export async function analyzeRepository(
  repoUrl: string,
  options: AnalysisOptions
): Promise<AnalysisResult> {
  // Implementation
}
```

### Code Style

- Use 2-space indentation
- Use single quotes for strings
- Use semicolons
- Maximum line length: 100 characters
- Use meaningful variable and function names

### Error Handling

Always handle errors explicitly:

```typescript
// Good
try {
  await analyzeRepo(url);
} catch (error) {
  if (error instanceof RepoNotFoundError) {
    logger.warn(`Repository not found: ${url}`);
    throw new UserFacingError('Repository not found', 404);
  }
  logger.error('Analysis failed', { error, url });
  throw error;
}

// Bad
try {
  await analyzeRepo(url);
} catch (e) {
  console.log(e);
}
```

## Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add entry to CHANGELOG.md
4. Request review from maintainers
5. Address feedback
6. Maintainer will merge

## Recognition

Contributors are recognized in:
- README.md Contributors section
- CHANGELOG.md release notes
- Nexus Marketplace plugin page

## Getting Help

- **Discord**: [Adverant Community](https://discord.gg/adverant)
- **Email**: plugins@adverant.ai
- **Discussions**: Use GitHub Discussions

Thank you for contributing!
