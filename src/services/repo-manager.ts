/**
 * Repository Manager Service
 * Handles Git operations for GitHub, GitLab, and Bitbucket repositories
 */

import simpleGit, { SimpleGit, CloneOptions as GitCloneOptions } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { glob } from 'glob';
import ignore from 'ignore';

import {
  GitPlatform,
  RepositoryInfo,
  RepositoryMetadata,
  DirectoryStructure,
  FileInfo,
  CloneOptions,
  RepositoryCloneResult,
  GitCredentials,
  RepositoryParseResult,
} from '../types';

const TEMP_DIR = process.env.REPO_TEMP_DIR || '/tmp/repos';
const MAX_FILE_SIZE = 1024 * 1024; // 1MB max file size for analysis
const CLONE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Default ignore patterns for analysis
 */
const DEFAULT_IGNORE_PATTERNS = [
  'node_modules/',
  '.git/',
  'vendor/',
  '__pycache__/',
  '*.pyc',
  '.next/',
  '.nuxt/',
  'dist/',
  'build/',
  'target/',
  '.cache/',
  'coverage/',
  '.nyc_output/',
  '*.min.js',
  '*.min.css',
  '*.bundle.js',
  '*.lock',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Gemfile.lock',
  'Cargo.lock',
  'poetry.lock',
  '*.log',
  '.env*',
  '.DS_Store',
  'Thumbs.db',
];

export class RepoManager {
  private git: SimpleGit;
  private credentials: GitCredentials[];
  private tempDir: string;

  constructor(credentials: GitCredentials[] = []) {
    this.git = simpleGit();
    this.credentials = credentials;
    this.tempDir = TEMP_DIR;
  }

  /**
   * Parse repository URL and extract platform, owner, and name
   */
  parseRepoUrl(url: string): RepositoryParseResult {
    try {
      // Normalize URL
      let normalizedUrl = url.trim();

      // Handle SSH URLs
      if (normalizedUrl.startsWith('git@')) {
        normalizedUrl = normalizedUrl
          .replace('git@github.com:', 'https://github.com/')
          .replace('git@gitlab.com:', 'https://gitlab.com/')
          .replace('git@bitbucket.org:', 'https://bitbucket.org/')
          .replace('.git', '');
      }

      // Remove trailing .git and slash
      normalizedUrl = normalizedUrl.replace(/\.git$/, '').replace(/\/$/, '');

      const urlObj = new URL(normalizedUrl);
      const hostname = urlObj.hostname.toLowerCase();
      const pathParts = urlObj.pathname.split('/').filter(Boolean);

      if (pathParts.length < 2) {
        return { isValid: false, error: 'Invalid repository URL format' };
      }

      let platform: GitPlatform;
      if (hostname.includes('github.com')) {
        platform = 'github';
      } else if (hostname.includes('gitlab.com') || hostname.includes('gitlab')) {
        platform = 'gitlab';
      } else if (hostname.includes('bitbucket.org') || hostname.includes('bitbucket')) {
        platform = 'bitbucket';
      } else {
        return { isValid: false, error: `Unsupported Git platform: ${hostname}` };
      }

      // Extract branch from URL if present (e.g., /tree/main)
      let branch: string | undefined;
      const treeIndex = pathParts.indexOf('tree');
      if (treeIndex !== -1 && pathParts[treeIndex + 1]) {
        branch = pathParts[treeIndex + 1];
      }

      return {
        isValid: true,
        platform,
        owner: pathParts[0],
        name: pathParts[1],
        branch,
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Failed to parse URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Build authenticated clone URL based on platform and credentials
   */
  private buildCloneUrl(info: RepositoryInfo): string {
    const credential = this.credentials.find((c) => c.platform === info.platform);

    if (credential?.token) {
      switch (info.platform) {
        case 'github':
          return `https://${credential.token}@github.com/${info.owner}/${info.name}.git`;
        case 'gitlab':
          return `https://oauth2:${credential.token}@gitlab.com/${info.owner}/${info.name}.git`;
        case 'bitbucket':
          return `https://x-token-auth:${credential.token}@bitbucket.org/${info.owner}/${info.name}.git`;
      }
    }

    // Fall back to public URL
    switch (info.platform) {
      case 'github':
        return `https://github.com/${info.owner}/${info.name}.git`;
      case 'gitlab':
        return `https://gitlab.com/${info.owner}/${info.name}.git`;
      case 'bitbucket':
        return `https://bitbucket.org/${info.owner}/${info.name}.git`;
    }
  }

  /**
   * Clone a repository to a temporary directory
   */
  async cloneRepository(
    repoUrl: string,
    options: CloneOptions = {}
  ): Promise<RepositoryCloneResult> {
    const startTime = Date.now();
    const parseResult = this.parseRepoUrl(repoUrl);

    if (!parseResult.isValid) {
      return {
        success: false,
        localPath: '',
        commitHash: '',
        branch: '',
        duration: Date.now() - startTime,
        error: parseResult.error,
      };
    }

    const repoInfo: RepositoryInfo = {
      url: repoUrl,
      platform: parseResult.platform!,
      owner: parseResult.owner!,
      name: parseResult.name!,
      branch: options.branch || parseResult.branch || 'main',
    };

    const cloneId = uuidv4();
    const localPath = path.join(this.tempDir, cloneId);

    try {
      // Ensure temp directory exists
      await fs.mkdir(this.tempDir, { recursive: true });

      const cloneUrl = this.buildCloneUrl(repoInfo);
      const cloneOptions: GitCloneOptions = {};

      // Shallow clone for faster operation
      if (options.depth) {
        cloneOptions['--depth'] = options.depth;
      } else {
        cloneOptions['--depth'] = 1;  // Default to shallow clone
      }

      // Single branch
      cloneOptions['--single-branch'] = null;

      // Specify branch
      if (repoInfo.branch) {
        cloneOptions['--branch'] = repoInfo.branch;
      }

      // Clone with timeout
      const clonePromise = this.git.clone(cloneUrl, localPath, cloneOptions);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Clone timeout exceeded')), options.timeout || CLONE_TIMEOUT);
      });

      await Promise.race([clonePromise, timeoutPromise]);

      // Get commit hash
      const repoGit = simpleGit(localPath);
      const log = await repoGit.log({ maxCount: 1 });
      const commitHash = log.latest?.hash || '';

      // Get actual branch name
      const branchResult = await repoGit.revparse(['--abbrev-ref', 'HEAD']);
      const actualBranch = branchResult.trim();

      return {
        success: true,
        localPath,
        commitHash,
        branch: actualBranch,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      // Cleanup on failure
      try {
        await fs.rm(localPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }

      return {
        success: false,
        localPath: '',
        commitHash: '',
        branch: '',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown clone error',
      };
    }
  }

  /**
   * Get repository metadata
   */
  async getRepositoryMetadata(localPath: string): Promise<RepositoryMetadata> {
    const stats = await this.calculateDirectoryStats(localPath);
    const repoGit = simpleGit(localPath);

    let lastCommitDate: Date | undefined;
    let contributors: number | undefined;

    try {
      const log = await repoGit.log({ maxCount: 1 });
      if (log.latest?.date) {
        lastCommitDate = new Date(log.latest.date);
      }

      // Count unique authors (may be limited in shallow clone)
      const allLogs = await repoGit.log();
      const authors = new Set(allLogs.all.map((commit) => commit.author_email));
      contributors = authors.size;
    } catch {
      // Ignore errors for metadata
    }

    return {
      sizeBytes: stats.totalSize,
      fileCount: stats.fileCount,
      directoryCount: stats.directoryCount,
      lastCommitDate,
      contributors,
    };
  }

  /**
   * Calculate directory statistics
   */
  private async calculateDirectoryStats(
    dirPath: string
  ): Promise<{ totalSize: number; fileCount: number; directoryCount: number }> {
    let totalSize = 0;
    let fileCount = 0;
    let directoryCount = 0;

    const processDir = async (currentPath: string): Promise<void> => {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          if (entry.name !== '.git' && entry.name !== 'node_modules') {
            directoryCount++;
            await processDir(fullPath);
          }
        } else if (entry.isFile()) {
          fileCount++;
          try {
            const stat = await fs.stat(fullPath);
            totalSize += stat.size;
          } catch {
            // Ignore file stat errors
          }
        }
      }
    };

    await processDir(dirPath);
    return { totalSize, fileCount, directoryCount };
  }

  /**
   * Get directory structure
   */
  async getDirectoryStructure(
    localPath: string,
    maxDepth: number = 5,
    ignorePatterns: string[] = DEFAULT_IGNORE_PATTERNS
  ): Promise<DirectoryStructure> {
    const ig = ignore().add(ignorePatterns);

    const buildStructure = async (
      currentPath: string,
      relativePath: string,
      depth: number
    ): Promise<DirectoryStructure> => {
      const name = path.basename(currentPath) || path.basename(localPath);
      const structure: DirectoryStructure = {
        path: relativePath,
        name,
        type: 'directory',
      };

      if (depth >= maxDepth) {
        return structure;
      }

      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        const children: DirectoryStructure[] = [];

        for (const entry of entries) {
          const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

          // Skip ignored paths
          if (ig.ignores(entryRelPath)) {
            continue;
          }

          const entryFullPath = path.join(currentPath, entry.name);

          if (entry.isDirectory()) {
            children.push(await buildStructure(entryFullPath, entryRelPath, depth + 1));
          } else if (entry.isFile()) {
            const stat = await fs.stat(entryFullPath);
            children.push({
              path: entryRelPath,
              name: entry.name,
              type: 'file',
              size: stat.size,
            });
          }
        }

        // Sort: directories first, then files, alphabetically
        children.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        structure.children = children;
      } catch {
        // Ignore read errors
      }

      return structure;
    };

    return buildStructure(localPath, '', 0);
  }

  /**
   * Get list of files matching patterns
   */
  async getFiles(
    localPath: string,
    patterns: string[] = ['**/*'],
    ignorePatterns: string[] = DEFAULT_IGNORE_PATTERNS
  ): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const ig = ignore().add(ignorePatterns);

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: localPath,
        nodir: true,
        absolute: false,
      });

      for (const match of matches) {
        if (ig.ignores(match)) {
          continue;
        }

        try {
          const fullPath = path.join(localPath, match);
          const stat = await fs.stat(fullPath);

          files.push({
            path: match,
            name: path.basename(match),
            extension: path.extname(match).toLowerCase(),
            size: stat.size,
            language: this.detectLanguage(match),
          });
        } catch {
          // Ignore file errors
        }
      }
    }

    return files;
  }

  /**
   * Read file content
   */
  async readFile(localPath: string, filePath: string): Promise<string | null> {
    try {
      const fullPath = path.join(localPath, filePath);
      const stat = await fs.stat(fullPath);

      if (stat.size > MAX_FILE_SIZE) {
        return null; // File too large
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Read multiple files
   */
  async readFiles(
    localPath: string,
    filePaths: string[]
  ): Promise<Record<string, string>> {
    const contents: Record<string, string> = {};

    await Promise.all(
      filePaths.map(async (filePath) => {
        const content = await this.readFile(localPath, filePath);
        if (content !== null) {
          contents[filePath] = content;
        }
      })
    );

    return contents;
  }

  /**
   * Detect programming language from file path
   */
  private detectLanguage(filePath: string): string | undefined {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.kt': 'kotlin',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.php': 'php',
      '.cs': 'csharp',
      '.swift': 'swift',
      '.m': 'objective-c',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.vue': 'vue',
      '.svelte': 'svelte',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.md': 'markdown',
      '.sql': 'sql',
      '.sh': 'bash',
      '.bash': 'bash',
      '.zsh': 'zsh',
      '.dockerfile': 'dockerfile',
      '.tf': 'terraform',
      '.proto': 'protobuf',
      '.graphql': 'graphql',
      '.gql': 'graphql',
    };

    // Handle special cases
    const fileName = path.basename(filePath).toLowerCase();
    if (fileName === 'dockerfile') return 'dockerfile';
    if (fileName === 'makefile') return 'makefile';
    if (fileName === 'gemfile') return 'ruby';
    if (fileName === 'rakefile') return 'ruby';
    if (fileName === 'vagrantfile') return 'ruby';

    return languageMap[ext];
  }

  /**
   * Cleanup cloned repository
   */
  async cleanup(localPath: string): Promise<void> {
    try {
      await fs.rm(localPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Cleanup all temporary repositories
   */
  async cleanupAll(): Promise<void> {
    try {
      const entries = await fs.readdir(this.tempDir);
      await Promise.all(
        entries.map((entry) =>
          fs.rm(path.join(this.tempDir, entry), { recursive: true, force: true })
        )
      );
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Check if repository is accessible
   */
  async checkAccess(repoUrl: string): Promise<{ accessible: boolean; error?: string }> {
    const parseResult = this.parseRepoUrl(repoUrl);
    if (!parseResult.isValid) {
      return { accessible: false, error: parseResult.error };
    }

    try {
      const repoInfo: RepositoryInfo = {
        url: repoUrl,
        platform: parseResult.platform!,
        owner: parseResult.owner!,
        name: parseResult.name!,
        branch: 'HEAD',
      };

      const cloneUrl = this.buildCloneUrl(repoInfo);

      // Try ls-remote to check access without cloning
      await this.git.listRemote([cloneUrl]);

      return { accessible: true };
    } catch (error) {
      return {
        accessible: false,
        error: error instanceof Error ? error.message : 'Repository not accessible',
      };
    }
  }

  /**
   * Get default branch name
   */
  async getDefaultBranch(repoUrl: string): Promise<string> {
    const parseResult = this.parseRepoUrl(repoUrl);
    if (!parseResult.isValid) {
      return 'main';
    }

    try {
      const repoInfo: RepositoryInfo = {
        url: repoUrl,
        platform: parseResult.platform!,
        owner: parseResult.owner!,
        name: parseResult.name!,
        branch: 'HEAD',
      };

      const cloneUrl = this.buildCloneUrl(repoInfo);
      const result = await this.git.listRemote(['--symref', cloneUrl, 'HEAD']);

      // Parse output like: ref: refs/heads/main	HEAD
      const match = result.match(/ref: refs\/heads\/(\S+)/);
      if (match) {
        return match[1];
      }
    } catch {
      // Ignore errors
    }

    return 'main';
  }
}

export default RepoManager;
