/**
 * Analysis API Routes for RepoSwarm
 * Handles repository analysis requests
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AnalysisOrchestrator } from '../services/analysis-orchestrator';
import { CacheService } from '../services/cache-service';
import { OutputGenerator } from '../services/output-generator';
import { RepoManager } from '../services/repo-manager';
import { PromptEngine } from '../services/prompt-engine';
import {
  TenantContext,
  AnalysisDepth,
  ExportFormat,
  FindingType,
  AnalysisResult,
  Finding,
} from '../types';

// Create shared service instances
const createOrchestrator = (tenantContext: TenantContext): AnalysisOrchestrator => {
  const repoManager = new RepoManager();  // Uses default empty credentials
  const cacheService = new CacheService(tenantContext);
  const outputGenerator = new OutputGenerator(tenantContext);
  const promptEngine = new PromptEngine(tenantContext);
  return new AnalysisOrchestrator(repoManager, cacheService, outputGenerator, promptEngine);
};

const router = Router();

// Types for request bodies
interface AnalyzeRequest {
  repoUrl: string;
  branch?: string;
  force?: boolean;
  analysisDepth?: AnalysisDepth;
  includeSecurityScan?: boolean;
  includePerformance?: boolean;
  includeDocumentation?: boolean;
  includeTesting?: boolean;
  includeMaintainability?: boolean;
  webhookUrl?: string;
}

interface BatchAnalyzeRequest {
  repositories: Array<{
    url: string;
    branch?: string;
  }>;
  options?: Omit<AnalyzeRequest, 'repoUrl' | 'branch'>;
}

interface ExportRequest {
  format: ExportFormat;
  includeSections?: FindingType[];
}

// Middleware to extract tenant context
const extractTenantContext = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const tenantContext: TenantContext = {
    userId: req.headers['x-user-id'] as string || '',
    tenantId: req.headers['x-tenant-id'] as string || '',
    companyId: req.headers['x-company-id'] as string,
    appId: req.headers['x-app-id'] as string,
    sessionId: req.headers['x-session-id'] as string,
    requestId: req.headers['x-request-id'] as string || uuidv4(),
  };

  (req as Request & { tenantContext: TenantContext }).tenantContext = tenantContext;
  next();
};

router.use(extractTenantContext);

/**
 * POST /analyze
 * Start a new repository analysis
 */
router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const body = req.body as AnalyzeRequest;

    // Validate required fields
    if (!body.repoUrl) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REPO_URL',
          message: 'Repository URL is required',
        },
      });
      return;
    }

    // Check cache if not forcing reanalysis
    if (!body.force) {
      const cacheService = new CacheService(tenantContext);
      const cached = await cacheService.get(body.repoUrl, body.branch);

      if (cached) {
        res.json({
          success: true,
          data: {
            analysisId: cached.commitHash,
            status: 'completed',
            cacheHit: true,
            result: cached.result,
          },
          meta: {
            requestId: tenantContext.requestId || '',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
          },
        });
        return;
      }
    }

    // Initialize orchestrator and start analysis
    const orchestrator = createOrchestrator(tenantContext);

    // Start analysis (async - will return immediately)
    const analysis = await orchestrator.startAnalysis({
      repoUrl: body.repoUrl,
      branch: body.branch,
      analysisDepth: body.analysisDepth || 'standard',
      includeSecurityScan: body.includeSecurityScan,
      force: body.force,
      webhookUrl: body.webhookUrl,
    }, tenantContext);

    res.status(202).json({
      success: true,
      data: {
        analysisId: analysis.id,
        status: 'queued',
        estimatedDuration: getEstimatedDuration(body.analysisDepth),
        cacheHit: false,
      },
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Analysis start failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYSIS_START_FAILED',
        message: error instanceof Error ? error.message : 'Failed to start analysis',
      },
    });
  }
});

/**
 * GET /analysis/:analysisId
 * Get analysis result by ID
 */
router.get('/analysis/:analysisId', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { analysisId } = req.params;

    // In production, this would query the database
    // For now, we'll use the cache service
    const cacheService = new CacheService(tenantContext);

    // Try to get by commit hash (which we use as analysis ID for cached results)
    // In real implementation, this would be a database lookup
    const result = await getAnalysisFromDatabase(analysisId, tenantContext);

    if (!result) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ANALYSIS_NOT_FOUND',
          message: `Analysis ${analysisId} not found`,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Get analysis failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_ANALYSIS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get analysis',
      },
    });
  }
});

/**
 * POST /analyze/batch
 * Start batch analysis for multiple repositories
 */
router.post('/analyze/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const body = req.body as BatchAnalyzeRequest;

    if (!body.repositories || body.repositories.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REPOSITORIES',
          message: 'At least one repository is required',
        },
      });
      return;
    }

    // Limit batch size
    const maxBatchSize = 10;
    if (body.repositories.length > maxBatchSize) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BATCH_SIZE_EXCEEDED',
          message: `Maximum batch size is ${maxBatchSize} repositories`,
        },
      });
      return;
    }

    const batchId = uuidv4();
    const analyses: Array<{ repoUrl: string; analysisId: string; status: string }> = [];

    for (const repo of body.repositories) {
      const orchestrator = createOrchestrator(tenantContext);

      const analysis = await orchestrator.startAnalysis({
        repoUrl: repo.url,
        branch: repo.branch,
        analysisDepth: body.options?.analysisDepth || 'standard',
        includeSecurityScan: body.options?.includeSecurityScan,
        force: body.options?.force,
        webhookUrl: body.options?.webhookUrl,
      }, tenantContext);

      analyses.push({
        repoUrl: repo.url,
        analysisId: analysis.id,
        status: 'queued',
      });
    }

    res.status(202).json({
      success: true,
      data: {
        batchId,
        analyses,
        totalCount: analyses.length,
      },
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Batch analysis failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BATCH_ANALYSIS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to start batch analysis',
      },
    });
  }
});

/**
 * GET /history
 * Get analysis history for a repository or all repositories
 */
router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { repoUrl, limit = '20', offset = '0' } = req.query;

    const history = await getAnalysisHistory(
      tenantContext,
      repoUrl as string | undefined,
      parseInt(limit as string, 10),
      parseInt(offset as string, 10)
    );

    res.json({
      success: true,
      data: history,
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Get history failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_HISTORY_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get history',
      },
    });
  }
});

/**
 * GET /export/:analysisId
 * Export analysis result in specified format
 */
router.get('/export/:analysisId', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { analysisId } = req.params;
    const format = (req.query.format as ExportFormat) || 'markdown';
    const includeSections = req.query.sections
      ? (req.query.sections as string).split(',') as FindingType[]
      : undefined;

    // Get analysis result
    const result = await getAnalysisFromDatabase(analysisId, tenantContext);

    if (!result) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ANALYSIS_NOT_FOUND',
          message: `Analysis ${analysisId} not found`,
        },
      });
      return;
    }

    // Generate output
    const generator = new OutputGenerator(tenantContext);
    const output = await generator.generate(result as AnalysisResult, {
      format,
      includeSections,
    });

    // Set appropriate headers
    res.setHeader('Content-Type', output.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${output.filename}"`);

    if (Buffer.isBuffer(output.content)) {
      res.send(output.content);
    } else {
      res.send(output.content);
    }
  } catch (error) {
    console.error('Export failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EXPORT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to export analysis',
      },
    });
  }
});

/**
 * GET /compare
 * Compare two analysis results
 */
router.get('/compare', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { from, to } = req.query;

    if (!from || !to) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ANALYSIS_IDS',
          message: 'Both "from" and "to" analysis IDs are required',
        },
      });
      return;
    }

    const fromResult = await getAnalysisFromDatabase(from as string, tenantContext);
    const toResult = await getAnalysisFromDatabase(to as string, tenantContext);

    if (!fromResult || !toResult) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ANALYSIS_NOT_FOUND',
          message: 'One or both analyses not found',
        },
      });
      return;
    }

    const comparison = compareAnalyses(fromResult as AnalysisResult, toResult as AnalysisResult);

    res.json({
      success: true,
      data: comparison,
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Compare failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'COMPARE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to compare analyses',
      },
    });
  }
});

/**
 * DELETE /analysis/:analysisId
 * Delete an analysis result
 */
router.delete('/analysis/:analysisId', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { analysisId } = req.params;

    await deleteAnalysis(analysisId, tenantContext);

    res.json({
      success: true,
      data: {
        deleted: true,
        analysisId,
      },
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Delete analysis failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to delete analysis',
      },
    });
  }
});

// Helper functions

function getEstimatedDuration(depth?: AnalysisDepth): number {
  switch (depth) {
    case 'quick':
      return 30;
    case 'deep':
      return 300;
    case 'standard':
    default:
      return 120;
  }
}

async function getAnalysisFromDatabase(
  analysisId: string,
  tenantContext: TenantContext
): Promise<AnalysisResult | null> {
  // TODO: Implement database query
  // For now, return null - would query reposwarm.analyses table
  console.log('Getting analysis from database:', analysisId, tenantContext.tenantId);
  return null;
}

async function getAnalysisHistory(
  tenantContext: TenantContext,
  repoUrl?: string,
  limit = 20,
  offset = 0
): Promise<{ items: AnalysisResult[]; total: number; hasMore: boolean }> {
  // TODO: Implement database query
  console.log('Getting analysis history:', tenantContext.tenantId, repoUrl, limit, offset);
  return { items: [], total: 0, hasMore: false };
}

async function deleteAnalysis(
  analysisId: string,
  tenantContext: TenantContext
): Promise<void> {
  // TODO: Implement database delete
  console.log('Deleting analysis:', analysisId, tenantContext.tenantId);
}

function compareAnalyses(
  from: AnalysisResult,
  to: AnalysisResult
): {
  architectureChanges: string[];
  newFindings: number;
  resolvedFindings: number;
  techStackChanges: { added: string[]; removed: string[] };
} {
  const fromFindings = new Set(from.findings.map((f) => f.title));
  const toFindings = new Set(to.findings.map((f) => f.title));

  const newFindings = to.findings.filter((f) => !fromFindings.has(f.title)).length;
  const resolvedFindings = from.findings.filter((f) => !toFindings.has(f.title)).length;

  const fromTech = new Set(from.techStack);
  const toTech = new Set(to.techStack);

  const added = to.techStack.filter((t) => !fromTech.has(t));
  const removed = from.techStack.filter((t) => !toTech.has(t));

  const architectureChanges: string[] = [];
  if (from.architecture.pattern !== to.architecture.pattern) {
    architectureChanges.push(
      `Architecture pattern changed from ${from.architecture.pattern} to ${to.architecture.pattern}`
    );
  }
  if (from.architecture.layers.length !== to.architecture.layers.length) {
    architectureChanges.push(
      `Number of layers changed from ${from.architecture.layers.length} to ${to.architecture.layers.length}`
    );
  }

  return {
    architectureChanges,
    newFindings,
    resolvedFindings,
    techStackChanges: { added, removed },
  };
}

export default router;
