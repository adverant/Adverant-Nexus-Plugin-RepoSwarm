/**
 * Cache Service for RepoSwarm
 * Integrates with GraphRAG for intelligent analysis caching and pattern learning
 */

import axios from 'axios';
import { AnalysisResult, TenantContext } from '../types';

const GRAPHRAG_URL = process.env.GRAPHRAG_URL || 'http://nexus-graphrag:9020';
const CACHE_TTL_DAYS = 7;

interface CacheEntry {
  repoUrl: string;
  branch: string;
  commitHash: string;
  result: AnalysisResult;
  createdAt: Date;
  expiresAt: Date;
  version: string;
}

interface GraphRAGMemoryRequest {
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  ttl?: number;
}

interface GraphRAGRecallRequest {
  query: string;
  limit?: number;
  tags?: string[];
  score_threshold?: number;
}

interface GraphRAGMemory {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export class CacheService {
  private tenantContext?: TenantContext;
  private version: string;

  constructor(tenantContext?: TenantContext) {
    this.tenantContext = tenantContext;
    this.version = '1.0.0';
  }

  /**
   * Get cached analysis result
   */
  async get(repoUrl: string, branch?: string): Promise<CacheEntry | null> {
    try {
      const cacheKey = this.buildCacheKey(repoUrl, branch);

      const response = await axios.post<{ memories: GraphRAGMemory[] }>(
        `${GRAPHRAG_URL}/v1/memory/recall`,
        {
          query: cacheKey,
          limit: 1,
          tags: ['reposwarm', 'analysis-cache'],
          score_threshold: 0.95, // High threshold for exact match
        } as GraphRAGRecallRequest,
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      if (response.data.memories && response.data.memories.length > 0) {
        const memory = response.data.memories[0];
        const cacheEntry = JSON.parse(memory.content) as CacheEntry;

        // Check if cache is still valid
        if (new Date(cacheEntry.expiresAt) > new Date()) {
          return cacheEntry;
        }

        // Cache expired, delete it
        await this.delete(memory.id);
      }

      return null;
    } catch (error) {
      console.error('Cache get failed:', error);
      return null;
    }
  }

  /**
   * Get cached result by commit hash (exact match)
   */
  async getByCommit(repoUrl: string, commitHash: string): Promise<CacheEntry | null> {
    try {
      const response = await axios.post<{ memories: GraphRAGMemory[] }>(
        `${GRAPHRAG_URL}/v1/memory/recall`,
        {
          query: `reposwarm analysis ${repoUrl} commit:${commitHash}`,
          limit: 1,
          tags: ['reposwarm', 'analysis-cache', `commit:${commitHash}`],
          score_threshold: 0.99,
        } as GraphRAGRecallRequest,
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      if (response.data.memories && response.data.memories.length > 0) {
        const cacheEntry = JSON.parse(response.data.memories[0].content) as CacheEntry;
        return cacheEntry;
      }

      return null;
    } catch (error) {
      console.error('Cache get by commit failed:', error);
      return null;
    }
  }

  /**
   * Store analysis result in cache
   */
  async set(
    repoUrl: string,
    branch: string,
    commitHash: string,
    result: AnalysisResult
  ): Promise<void> {
    try {
      const cacheEntry: CacheEntry = {
        repoUrl,
        branch,
        commitHash,
        result,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000),
        version: this.version,
      };

      const cacheKey = this.buildCacheKey(repoUrl, branch);

      await axios.post(
        `${GRAPHRAG_URL}/v1/memory/store`,
        {
          content: JSON.stringify(cacheEntry),
          tags: [
            'reposwarm',
            'analysis-cache',
            `repo:${this.sanitizeTag(repoUrl)}`,
            `branch:${branch}`,
            `commit:${commitHash}`,
            `type:${result.detectedType}`,
            ...result.techStack.map((t) => `tech:${t}`),
          ],
          metadata: {
            cacheKey,
            repoUrl,
            branch,
            commitHash,
            detectedType: result.detectedType,
            techStack: result.techStack,
            version: this.version,
            expiresAt: cacheEntry.expiresAt.toISOString(),
          },
          ttl: CACHE_TTL_DAYS * 24 * 60 * 60, // TTL in seconds
        } as GraphRAGMemoryRequest,
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );
    } catch (error) {
      console.error('Cache set failed:', error);
      // Don't throw - caching failures shouldn't break analysis
    }
  }

  /**
   * Invalidate cache for a repository
   */
  async invalidate(repoUrl: string, branch?: string): Promise<void> {
    try {
      // Recall all cached entries for this repo
      const response = await axios.post<{ memories: GraphRAGMemory[] }>(
        `${GRAPHRAG_URL}/v1/memory/recall`,
        {
          query: `reposwarm analysis ${repoUrl}`,
          limit: 100,
          tags: ['reposwarm', 'analysis-cache', `repo:${this.sanitizeTag(repoUrl)}`],
        } as GraphRAGRecallRequest,
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      // Delete each cached entry
      if (response.data.memories) {
        await Promise.all(
          response.data.memories.map((memory) => this.delete(memory.id))
        );
      }
    } catch (error) {
      console.error('Cache invalidation failed:', error);
    }
  }

  /**
   * Delete a specific cache entry
   */
  private async delete(memoryId: string): Promise<void> {
    try {
      await axios.delete(`${GRAPHRAG_URL}/v1/memory/${memoryId}`, {
        headers: this.getHeaders(),
        timeout: 5000,
      });
    } catch (error) {
      console.error('Cache delete failed:', error);
    }
  }

  /**
   * Store successful analysis pattern for learning
   */
  async storePattern(
    repoUrl: string,
    result: AnalysisResult
  ): Promise<void> {
    try {
      // Store pattern for similar repository detection
      const pattern = {
        type: result.detectedType,
        techStack: result.techStack,
        architecturePattern: result.architecture.pattern,
        keyIndicators: this.extractKeyIndicators(result),
      };

      await axios.post(
        `${GRAPHRAG_URL}/v1/memory/store`,
        {
          content: JSON.stringify({
            pattern,
            repoUrl,
            timestamp: new Date().toISOString(),
          }),
          tags: [
            'reposwarm',
            'analysis-pattern',
            `type:${result.detectedType}`,
            `arch:${result.architecture.pattern}`,
            ...result.techStack.slice(0, 5).map((t) => `tech:${t}`),
          ],
          metadata: {
            type: 'analysis-pattern',
            detectedType: result.detectedType,
            architecturePattern: result.architecture.pattern,
            techStackCount: result.techStack.length,
          },
        } as GraphRAGMemoryRequest,
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );
    } catch (error) {
      console.error('Pattern storage failed:', error);
    }
  }

  /**
   * Recall similar analysis patterns for context
   */
  async recallPatterns(
    repoType: string,
    techStack: string[]
  ): Promise<unknown[]> {
    try {
      const response = await axios.post<{ memories: GraphRAGMemory[] }>(
        `${GRAPHRAG_URL}/v1/memory/recall`,
        {
          query: `reposwarm analysis pattern type:${repoType} ${techStack.slice(0, 3).join(' ')}`,
          limit: 5,
          tags: ['reposwarm', 'analysis-pattern'],
          score_threshold: 0.7,
        } as GraphRAGRecallRequest,
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      if (response.data.memories) {
        return response.data.memories.map((m) => JSON.parse(m.content));
      }

      return [];
    } catch (error) {
      console.error('Pattern recall failed:', error);
      return [];
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalCached: number;
    patternsStored: number;
    hitRate?: number;
  }> {
    try {
      // Count cached analyses
      const cacheResponse = await axios.post<{ memories: GraphRAGMemory[] }>(
        `${GRAPHRAG_URL}/v1/memory/recall`,
        {
          query: 'reposwarm analysis-cache',
          limit: 1000,
          tags: ['reposwarm', 'analysis-cache'],
        } as GraphRAGRecallRequest,
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      // Count patterns
      const patternResponse = await axios.post<{ memories: GraphRAGMemory[] }>(
        `${GRAPHRAG_URL}/v1/memory/recall`,
        {
          query: 'reposwarm analysis-pattern',
          limit: 1000,
          tags: ['reposwarm', 'analysis-pattern'],
        } as GraphRAGRecallRequest,
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      return {
        totalCached: cacheResponse.data.memories?.length || 0,
        patternsStored: patternResponse.data.memories?.length || 0,
      };
    } catch (error) {
      console.error('Cache stats failed:', error);
      return { totalCached: 0, patternsStored: 0 };
    }
  }

  /**
   * Build a cache key from repo URL and branch
   */
  private buildCacheKey(repoUrl: string, branch?: string): string {
    const normalizedUrl = repoUrl.toLowerCase().replace(/\.git$/, '');
    return `reposwarm:cache:${normalizedUrl}:${branch || 'default'}`;
  }

  /**
   * Sanitize a string for use as a tag
   */
  private sanitizeTag(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
  }

  /**
   * Extract key indicators from analysis result for pattern matching
   */
  private extractKeyIndicators(result: AnalysisResult): string[] {
    const indicators: string[] = [];

    // Add architecture pattern
    indicators.push(`arch:${result.architecture.pattern}`);

    // Add layer types
    result.architecture.layers.forEach((layer) => {
      indicators.push(`layer:${layer.type}`);
    });

    // Add component types
    const componentTypes = new Set(result.architecture.components.map((c) => c.type));
    componentTypes.forEach((type) => {
      indicators.push(`component:${type}`);
    });

    // Add finding categories
    const findingTypes = new Set(result.findings.map((f) => f.findingType));
    findingTypes.forEach((type) => {
      indicators.push(`finding:${type}`);
    });

    return indicators;
  }

  /**
   * Get request headers including tenant context
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.tenantContext) {
      headers['X-Tenant-Id'] = this.tenantContext.tenantId;
      headers['X-User-Id'] = this.tenantContext.userId;
      if (this.tenantContext.requestId) {
        headers['X-Request-Id'] = this.tenantContext.requestId;
      }
    }

    return headers;
  }

  /**
   * Set tenant context for subsequent requests
   */
  setTenantContext(context: TenantContext): void {
    this.tenantContext = context;
  }
}

export default CacheService;
