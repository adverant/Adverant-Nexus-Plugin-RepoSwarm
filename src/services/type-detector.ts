/**
 * Repository Type Detection Service
 * Analyzes repository structure to determine project type and tech stack
 */

import * as path from 'path';
import {
  RepositoryType,
  TechStack,
  TypeDetectionResult,
  TypeIndicator,
  TYPE_DETECTION_PATTERNS,
  TECH_STACK_PATTERNS,
  FileInfo,
  DirectoryStructure,
} from '../types';
import { RepoManager } from './repo-manager';

/**
 * Weights for different detection methods
 */
const DETECTION_WEIGHTS = {
  file: 0.3,
  dependency: 0.4,
  pattern: 0.2,
  structure: 0.1,
};

/**
 * Priority order for type detection (higher = checked first)
 */
const TYPE_PRIORITY: Record<RepositoryType, number> = {
  'infra-as-code': 100,
  'library': 90,
  'monorepo': 85,
  'mobile': 80,
  'frontend': 70,
  'backend': 60,
  'unknown': 0,
};

export class TypeDetector {
  private repoManager: RepoManager;

  constructor(repoManager: RepoManager) {
    this.repoManager = repoManager;
  }

  /**
   * Detect repository type and tech stack
   */
  async detect(
    localPath: string,
    directoryStructure: DirectoryStructure,
    files: FileInfo[]
  ): Promise<TypeDetectionResult> {
    const indicators: TypeIndicator[] = [];

    // Collect all indicators
    await this.detectFromFiles(localPath, files, indicators);
    await this.detectFromDependencies(localPath, indicators);
    this.detectFromStructure(directoryStructure, indicators);

    // Calculate scores for each type
    const typeScores = this.calculateTypeScores(indicators);

    // Determine primary type
    const sortedTypes = Object.entries(typeScores)
      .filter(([_, score]) => score > 0)
      .sort((a, b) => {
        // Sort by score, then by priority
        const scoreDiff = b[1] - a[1];
        if (Math.abs(scoreDiff) < 0.1) {
          return TYPE_PRIORITY[b[0] as RepositoryType] - TYPE_PRIORITY[a[0] as RepositoryType];
        }
        return scoreDiff;
      });

    const primaryType = (sortedTypes[0]?.[0] as RepositoryType) || 'unknown';
    const confidence = sortedTypes[0]?.[1] || 0;

    // Detect tech stack
    const techStack = await this.detectTechStack(localPath, files, indicators);

    // Check for monorepo sub-types
    let subTypes: RepositoryType[] | undefined;
    if (primaryType === 'monorepo') {
      subTypes = await this.detectMonorepoSubTypes(localPath, directoryStructure);
    }

    return {
      primaryType,
      confidence: Math.min(confidence, 1),
      techStack,
      indicators: indicators.filter((i) => i.confidence > 0.3),
      subTypes,
    };
  }

  /**
   * Detect from file presence
   */
  private async detectFromFiles(
    localPath: string,
    files: FileInfo[],
    indicators: TypeIndicator[]
  ): Promise<void> {
    const fileNames = new Set(files.map((f) => f.name.toLowerCase()));
    const filePaths = new Set(files.map((f) => f.path.toLowerCase()));

    for (const [repoType, patterns] of Object.entries(TYPE_DETECTION_PATTERNS)) {
      for (const pattern of patterns) {
        const normalizedPattern = pattern.toLowerCase().replace('/', '');

        // Check file names
        if (fileNames.has(normalizedPattern)) {
          indicators.push({
            type: 'file',
            name: pattern,
            confidence: 0.7,
            suggestedType: repoType as RepositoryType,
          });
          continue;
        }

        // Check paths (for directory patterns)
        if (pattern.endsWith('/')) {
          const dirName = pattern.slice(0, -1).toLowerCase();
          for (const filePath of filePaths) {
            if (filePath.startsWith(dirName + '/') || filePath.includes('/' + dirName + '/')) {
              indicators.push({
                type: 'file',
                name: pattern,
                path: filePath,
                confidence: 0.6,
                suggestedType: repoType as RepositoryType,
              });
              break;
            }
          }
        }
      }
    }
  }

  /**
   * Detect from package dependencies
   */
  private async detectFromDependencies(
    localPath: string,
    indicators: TypeIndicator[]
  ): Promise<void> {
    // Check package.json
    const packageJson = await this.readPackageJson(localPath);
    if (packageJson) {
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Check for framework-specific dependencies
      this.checkDependencies(allDeps, indicators);

      // Check package.json structure for library indicators
      if (packageJson.main || packageJson.exports || packageJson.types) {
        indicators.push({
          type: 'pattern',
          name: 'Library exports',
          confidence: 0.6,
          suggestedType: 'library',
        });
      }
    }

    // Check requirements.txt (Python)
    const requirements = await this.repoManager.readFile(localPath, 'requirements.txt');
    if (requirements) {
      this.checkPythonDependencies(requirements, indicators);
    }

    // Check go.mod (Go)
    const goMod = await this.repoManager.readFile(localPath, 'go.mod');
    if (goMod) {
      this.checkGoDependencies(goMod, indicators);
    }

    // Check Cargo.toml (Rust)
    const cargoToml = await this.repoManager.readFile(localPath, 'Cargo.toml');
    if (cargoToml) {
      this.checkRustDependencies(cargoToml, indicators);
    }
  }

  /**
   * Read and parse package.json
   */
  private async readPackageJson(localPath: string): Promise<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    main?: string;
    exports?: unknown;
    types?: string;
    scripts?: Record<string, string>;
  } | null> {
    const content = await this.repoManager.readFile(localPath, 'package.json');
    if (!content) return null;

    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Check npm/yarn dependencies for type indicators
   */
  private checkDependencies(
    deps: Record<string, string>,
    indicators: TypeIndicator[]
  ): void {
    const depNames = Object.keys(deps);

    // Frontend frameworks
    if (depNames.includes('react') || depNames.includes('react-dom')) {
      indicators.push({
        type: 'dependency',
        name: 'react',
        confidence: 0.8,
        suggestedType: 'frontend',
      });
    }
    if (depNames.includes('vue')) {
      indicators.push({
        type: 'dependency',
        name: 'vue',
        confidence: 0.8,
        suggestedType: 'frontend',
      });
    }
    if (depNames.includes('@angular/core')) {
      indicators.push({
        type: 'dependency',
        name: '@angular/core',
        confidence: 0.8,
        suggestedType: 'frontend',
      });
    }
    if (depNames.includes('svelte')) {
      indicators.push({
        type: 'dependency',
        name: 'svelte',
        confidence: 0.8,
        suggestedType: 'frontend',
      });
    }

    // Next.js/Nuxt (can be backend too)
    if (depNames.includes('next')) {
      indicators.push({
        type: 'dependency',
        name: 'next',
        confidence: 0.7,
        suggestedType: 'frontend',
      });
    }

    // Backend frameworks
    if (depNames.includes('express')) {
      indicators.push({
        type: 'dependency',
        name: 'express',
        confidence: 0.8,
        suggestedType: 'backend',
      });
    }
    if (depNames.includes('@nestjs/core')) {
      indicators.push({
        type: 'dependency',
        name: '@nestjs/core',
        confidence: 0.9,
        suggestedType: 'backend',
      });
    }
    if (depNames.includes('fastify')) {
      indicators.push({
        type: 'dependency',
        name: 'fastify',
        confidence: 0.8,
        suggestedType: 'backend',
      });
    }
    if (depNames.includes('koa')) {
      indicators.push({
        type: 'dependency',
        name: 'koa',
        confidence: 0.8,
        suggestedType: 'backend',
      });
    }

    // Mobile
    if (depNames.includes('react-native')) {
      indicators.push({
        type: 'dependency',
        name: 'react-native',
        confidence: 0.95,
        suggestedType: 'mobile',
      });
    }
    if (depNames.includes('@ionic/angular') || depNames.includes('@ionic/react') || depNames.includes('@ionic/vue')) {
      indicators.push({
        type: 'dependency',
        name: 'ionic',
        confidence: 0.9,
        suggestedType: 'mobile',
      });
    }
    if (depNames.includes('@capacitor/core')) {
      indicators.push({
        type: 'dependency',
        name: '@capacitor/core',
        confidence: 0.85,
        suggestedType: 'mobile',
      });
    }

    // Monorepo tools
    if (depNames.includes('lerna') || depNames.includes('nx') || depNames.includes('turbo')) {
      indicators.push({
        type: 'dependency',
        name: 'monorepo-tool',
        confidence: 0.9,
        suggestedType: 'monorepo',
      });
    }
  }

  /**
   * Check Python dependencies
   */
  private checkPythonDependencies(requirements: string, indicators: TypeIndicator[]): void {
    const deps = requirements.toLowerCase();

    if (deps.includes('django')) {
      indicators.push({
        type: 'dependency',
        name: 'django',
        confidence: 0.9,
        suggestedType: 'backend',
      });
    }
    if (deps.includes('flask')) {
      indicators.push({
        type: 'dependency',
        name: 'flask',
        confidence: 0.85,
        suggestedType: 'backend',
      });
    }
    if (deps.includes('fastapi')) {
      indicators.push({
        type: 'dependency',
        name: 'fastapi',
        confidence: 0.9,
        suggestedType: 'backend',
      });
    }
    if (deps.includes('kivy') || deps.includes('beeware')) {
      indicators.push({
        type: 'dependency',
        name: 'python-mobile',
        confidence: 0.8,
        suggestedType: 'mobile',
      });
    }
  }

  /**
   * Check Go dependencies
   */
  private checkGoDependencies(goMod: string, indicators: TypeIndicator[]): void {
    if (goMod.includes('github.com/gin-gonic/gin')) {
      indicators.push({
        type: 'dependency',
        name: 'gin',
        confidence: 0.9,
        suggestedType: 'backend',
      });
    }
    if (goMod.includes('github.com/gofiber/fiber')) {
      indicators.push({
        type: 'dependency',
        name: 'fiber',
        confidence: 0.9,
        suggestedType: 'backend',
      });
    }
    if (goMod.includes('github.com/labstack/echo')) {
      indicators.push({
        type: 'dependency',
        name: 'echo',
        confidence: 0.9,
        suggestedType: 'backend',
      });
    }
  }

  /**
   * Check Rust dependencies
   */
  private checkRustDependencies(cargoToml: string, indicators: TypeIndicator[]): void {
    if (cargoToml.includes('actix-web')) {
      indicators.push({
        type: 'dependency',
        name: 'actix-web',
        confidence: 0.9,
        suggestedType: 'backend',
      });
    }
    if (cargoToml.includes('rocket')) {
      indicators.push({
        type: 'dependency',
        name: 'rocket',
        confidence: 0.9,
        suggestedType: 'backend',
      });
    }
    if (cargoToml.includes('tauri')) {
      indicators.push({
        type: 'dependency',
        name: 'tauri',
        confidence: 0.85,
        suggestedType: 'frontend',
      });
    }
  }

  /**
   * Detect from directory structure
   */
  private detectFromStructure(
    structure: DirectoryStructure,
    indicators: TypeIndicator[]
  ): void {
    if (!structure.children) return;

    const topLevelDirs = structure.children
      .filter((c) => c.type === 'directory')
      .map((c) => c.name.toLowerCase());

    // Monorepo indicators
    if (topLevelDirs.includes('packages') || topLevelDirs.includes('apps')) {
      indicators.push({
        type: 'structure',
        name: 'monorepo-structure',
        confidence: 0.7,
        suggestedType: 'monorepo',
      });
    }

    // Infrastructure indicators
    if (topLevelDirs.includes('terraform') || topLevelDirs.includes('infrastructure')) {
      indicators.push({
        type: 'structure',
        name: 'infra-directory',
        confidence: 0.8,
        suggestedType: 'infra-as-code',
      });
    }

    // Mobile indicators
    if (topLevelDirs.includes('ios') && topLevelDirs.includes('android')) {
      indicators.push({
        type: 'structure',
        name: 'mobile-platforms',
        confidence: 0.9,
        suggestedType: 'mobile',
      });
    }

    // Frontend indicators
    if (topLevelDirs.includes('components') || topLevelDirs.includes('pages')) {
      indicators.push({
        type: 'structure',
        name: 'frontend-structure',
        confidence: 0.5,
        suggestedType: 'frontend',
      });
    }

    // Backend indicators
    if (
      topLevelDirs.includes('controllers') ||
      topLevelDirs.includes('routes') ||
      topLevelDirs.includes('api')
    ) {
      indicators.push({
        type: 'structure',
        name: 'backend-structure',
        confidence: 0.5,
        suggestedType: 'backend',
      });
    }

    // Library indicators
    if (topLevelDirs.includes('lib') || topLevelDirs.includes('src')) {
      const hasTests = topLevelDirs.includes('test') || topLevelDirs.includes('tests');
      const hasExamples = topLevelDirs.includes('examples');
      if (hasTests && hasExamples) {
        indicators.push({
          type: 'structure',
          name: 'library-structure',
          confidence: 0.6,
          suggestedType: 'library',
        });
      }
    }
  }

  /**
   * Calculate weighted scores for each type
   */
  private calculateTypeScores(indicators: TypeIndicator[]): Record<RepositoryType, number> {
    const scores: Record<RepositoryType, number> = {
      backend: 0,
      frontend: 0,
      mobile: 0,
      'infra-as-code': 0,
      library: 0,
      monorepo: 0,
      unknown: 0,
    };

    for (const indicator of indicators) {
      const weight = DETECTION_WEIGHTS[indicator.type];
      const score = indicator.confidence * weight;
      scores[indicator.suggestedType] += score;
    }

    // Normalize scores
    const maxScore = Math.max(...Object.values(scores), 0.01);
    for (const type of Object.keys(scores) as RepositoryType[]) {
      scores[type] = scores[type] / maxScore;
    }

    return scores;
  }

  /**
   * Detect tech stack
   */
  private async detectTechStack(
    localPath: string,
    files: FileInfo[],
    indicators: TypeIndicator[]
  ): Promise<TechStack[]> {
    const detected = new Set<TechStack>();
    const fileExtensions = new Set(files.map((f) => f.extension));
    const fileNames = new Set(files.map((f) => f.name.toLowerCase()));

    for (const [tech, patterns] of Object.entries(TECH_STACK_PATTERNS)) {
      // Check files
      if (patterns.files) {
        for (const filePattern of patterns.files) {
          if (filePattern.startsWith('*.')) {
            const ext = filePattern.slice(1);
            if (fileExtensions.has(ext)) {
              detected.add(tech as TechStack);
              break;
            }
          } else if (fileNames.has(filePattern.toLowerCase())) {
            detected.add(tech as TechStack);
            break;
          }
        }
      }

      // Check dependencies (from indicators)
      if (patterns.dependencies) {
        for (const dep of patterns.dependencies) {
          const hasIndicator = indicators.some(
            (i) => i.type === 'dependency' && i.name.toLowerCase().includes(dep.toLowerCase())
          );
          if (hasIndicator) {
            detected.add(tech as TechStack);
            break;
          }
        }
      }
    }

    // Also check package.json directly for more accurate detection
    const packageJson = await this.readPackageJson(localPath);
    if (packageJson) {
      const allDeps = Object.keys({
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      });

      for (const [tech, patterns] of Object.entries(TECH_STACK_PATTERNS)) {
        if (patterns.dependencies) {
          for (const dep of patterns.dependencies) {
            if (allDeps.some((d) => d.toLowerCase() === dep.toLowerCase())) {
              detected.add(tech as TechStack);
              break;
            }
          }
        }
      }
    }

    return Array.from(detected);
  }

  /**
   * Detect sub-types for monorepos
   */
  private async detectMonorepoSubTypes(
    localPath: string,
    structure: DirectoryStructure
  ): Promise<RepositoryType[]> {
    const subTypes = new Set<RepositoryType>();

    // Check common monorepo directories
    const packageDirs = ['packages', 'apps', 'libs', 'modules'];

    for (const dir of packageDirs) {
      const dirPath = structure.children?.find(
        (c) => c.type === 'directory' && c.name.toLowerCase() === dir
      );

      if (dirPath?.children) {
        for (const subDir of dirPath.children) {
          if (subDir.type === 'directory') {
            // Analyze each package
            const subLocalPath = path.join(localPath, dir, subDir.name);
            const files = await this.repoManager.getFiles(subLocalPath);
            const subStructure = await this.repoManager.getDirectoryStructure(subLocalPath, 2);

            const result = await this.detect(subLocalPath, subStructure, files);
            if (result.primaryType !== 'unknown' && result.primaryType !== 'monorepo') {
              subTypes.add(result.primaryType);
            }
          }
        }
      }
    }

    return Array.from(subTypes);
  }
}

export default TypeDetector;
