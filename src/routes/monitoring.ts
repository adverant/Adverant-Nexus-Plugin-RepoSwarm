/**
 * Monitoring API Routes for RepoSwarm
 * Handles continuous repository monitoring
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  TenantContext,
  Monitor,
  MonitorNotification,
  MonitorStatus,
} from '../types';

const router = Router();

// Types for request bodies
interface CreateMonitorRequest {
  repoUrl: string;
  branch?: string;
  pollIntervalHours?: number;
  webhookUrl?: string;
  notifyOn?: MonitorNotification[];
  emailNotifications?: boolean;
}

interface UpdateMonitorRequest {
  pollIntervalHours?: number;
  webhookUrl?: string;
  notifyOn?: MonitorNotification[];
  status?: MonitorStatus;
  emailNotifications?: boolean;
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
 * POST /monitors
 * Create a new repository monitor
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const body = req.body as CreateMonitorRequest;

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

    // Validate poll interval
    const pollIntervalHours = body.pollIntervalHours || 24;
    if (pollIntervalHours < 1 || pollIntervalHours > 168) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_POLL_INTERVAL',
          message: 'Poll interval must be between 1 and 168 hours',
        },
      });
      return;
    }

    // Check if monitor already exists
    const existingMonitor = await getExistingMonitor(body.repoUrl, tenantContext);
    if (existingMonitor) {
      res.status(409).json({
        success: false,
        error: {
          code: 'MONITOR_EXISTS',
          message: 'A monitor for this repository already exists',
          details: { monitorId: existingMonitor.id },
        },
      });
      return;
    }

    // Create monitor
    const monitor = await createMonitor({
      userId: tenantContext.userId,
      tenantId: tenantContext.tenantId,
      repoUrl: body.repoUrl,
      branch: body.branch,
      pollIntervalHours,
      webhookUrl: body.webhookUrl,
      notifyOn: body.notifyOn || ['architecture-change', 'security-issue'],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      data: monitor,
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Create monitor failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_MONITOR_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create monitor',
      },
    });
  }
});

/**
 * GET /monitors
 * List all monitors for the current user
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { status, limit = '50', offset = '0' } = req.query;

    const monitors = await listMonitors(
      tenantContext,
      status as MonitorStatus | undefined,
      parseInt(limit as string, 10),
      parseInt(offset as string, 10)
    );

    res.json({
      success: true,
      data: monitors,
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('List monitors failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_MONITORS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to list monitors',
      },
    });
  }
});

/**
 * GET /monitors/:monitorId
 * Get a specific monitor
 */
router.get('/:monitorId', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { monitorId } = req.params;

    const monitor = await getMonitor(monitorId, tenantContext);

    if (!monitor) {
      res.status(404).json({
        success: false,
        error: {
          code: 'MONITOR_NOT_FOUND',
          message: `Monitor ${monitorId} not found`,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: monitor,
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Get monitor failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_MONITOR_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get monitor',
      },
    });
  }
});

/**
 * PATCH /monitors/:monitorId
 * Update a monitor
 */
router.patch('/:monitorId', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { monitorId } = req.params;
    const body = req.body as UpdateMonitorRequest;

    // Get existing monitor
    const existing = await getMonitor(monitorId, tenantContext);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: {
          code: 'MONITOR_NOT_FOUND',
          message: `Monitor ${monitorId} not found`,
        },
      });
      return;
    }

    // Validate poll interval if provided
    if (body.pollIntervalHours !== undefined) {
      if (body.pollIntervalHours < 1 || body.pollIntervalHours > 168) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_POLL_INTERVAL',
            message: 'Poll interval must be between 1 and 168 hours',
          },
        });
        return;
      }
    }

    // Update monitor
    const updated = await updateMonitor(monitorId, tenantContext, body);

    res.json({
      success: true,
      data: updated,
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Update monitor failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_MONITOR_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update monitor',
      },
    });
  }
});

/**
 * POST /monitors/:monitorId/pause
 * Pause a monitor
 */
router.post('/:monitorId/pause', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { monitorId } = req.params;

    const monitor = await getMonitor(monitorId, tenantContext);
    if (!monitor) {
      res.status(404).json({
        success: false,
        error: {
          code: 'MONITOR_NOT_FOUND',
          message: `Monitor ${monitorId} not found`,
        },
      });
      return;
    }

    const updated = await updateMonitor(monitorId, tenantContext, { status: 'paused' });

    res.json({
      success: true,
      data: updated,
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Pause monitor failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PAUSE_MONITOR_FAILED',
        message: error instanceof Error ? error.message : 'Failed to pause monitor',
      },
    });
  }
});

/**
 * POST /monitors/:monitorId/resume
 * Resume a paused monitor
 */
router.post('/:monitorId/resume', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { monitorId } = req.params;

    const monitor = await getMonitor(monitorId, tenantContext);
    if (!monitor) {
      res.status(404).json({
        success: false,
        error: {
          code: 'MONITOR_NOT_FOUND',
          message: `Monitor ${monitorId} not found`,
        },
      });
      return;
    }

    if (monitor.status !== 'paused') {
      res.status(400).json({
        success: false,
        error: {
          code: 'MONITOR_NOT_PAUSED',
          message: 'Monitor is not paused',
        },
      });
      return;
    }

    const updated = await updateMonitor(monitorId, tenantContext, { status: 'active' });

    res.json({
      success: true,
      data: updated,
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Resume monitor failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RESUME_MONITOR_FAILED',
        message: error instanceof Error ? error.message : 'Failed to resume monitor',
      },
    });
  }
});

/**
 * POST /monitors/:monitorId/trigger
 * Manually trigger a monitor check
 */
router.post('/:monitorId/trigger', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { monitorId } = req.params;

    const monitor = await getMonitor(monitorId, tenantContext);
    if (!monitor) {
      res.status(404).json({
        success: false,
        error: {
          code: 'MONITOR_NOT_FOUND',
          message: `Monitor ${monitorId} not found`,
        },
      });
      return;
    }

    // Trigger immediate check
    const checkResult = await triggerMonitorCheck(monitor, tenantContext);

    res.json({
      success: true,
      data: checkResult,
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Trigger monitor failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TRIGGER_MONITOR_FAILED',
        message: error instanceof Error ? error.message : 'Failed to trigger monitor',
      },
    });
  }
});

/**
 * DELETE /monitors/:monitorId
 * Delete a monitor
 */
router.delete('/:monitorId', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { monitorId } = req.params;

    const monitor = await getMonitor(monitorId, tenantContext);
    if (!monitor) {
      res.status(404).json({
        success: false,
        error: {
          code: 'MONITOR_NOT_FOUND',
          message: `Monitor ${monitorId} not found`,
        },
      });
      return;
    }

    await deleteMonitor(monitorId, tenantContext);

    res.json({
      success: true,
      data: {
        deleted: true,
        monitorId,
      },
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Delete monitor failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_MONITOR_FAILED',
        message: error instanceof Error ? error.message : 'Failed to delete monitor',
      },
    });
  }
});

/**
 * GET /monitors/:monitorId/history
 * Get check history for a monitor
 */
router.get('/:monitorId/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { monitorId } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    const monitor = await getMonitor(monitorId, tenantContext);
    if (!monitor) {
      res.status(404).json({
        success: false,
        error: {
          code: 'MONITOR_NOT_FOUND',
          message: `Monitor ${monitorId} not found`,
        },
      });
      return;
    }

    const history = await getMonitorHistory(
      monitorId,
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
    console.error('Get monitor history failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_HISTORY_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get monitor history',
      },
    });
  }
});

// Helper functions - would be replaced with actual database operations

interface MonitorInput {
  userId: string;
  tenantId: string;
  repoUrl: string;
  branch?: string;
  pollIntervalHours: number;
  webhookUrl?: string;
  notifyOn: MonitorNotification[];
  status: MonitorStatus;
  createdAt: Date;
  updatedAt: Date;
}

async function getExistingMonitor(
  repoUrl: string,
  tenantContext: TenantContext
): Promise<Monitor | null> {
  // TODO: Query database for existing active monitor
  console.log('Checking existing monitor:', repoUrl, tenantContext.userId);
  return null;
}

async function createMonitor(input: MonitorInput): Promise<Monitor> {
  // TODO: Insert into database
  const monitor: Monitor = {
    id: uuidv4(),
    userId: input.userId,
    tenantId: input.tenantId,
    repoUrl: input.repoUrl,
    branch: input.branch,
    pollIntervalHours: input.pollIntervalHours,
    webhookUrl: input.webhookUrl,
    notifyOn: input.notifyOn,
    status: input.status,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };

  console.log('Created monitor:', monitor.id);
  return monitor;
}

async function listMonitors(
  tenantContext: TenantContext,
  status?: MonitorStatus,
  limit = 50,
  offset = 0
): Promise<{ items: Monitor[]; total: number; hasMore: boolean }> {
  // TODO: Query database
  console.log('Listing monitors:', tenantContext.userId, status, limit, offset);
  return { items: [], total: 0, hasMore: false };
}

async function getMonitor(
  monitorId: string,
  tenantContext: TenantContext
): Promise<Monitor | null> {
  // TODO: Query database
  console.log('Getting monitor:', monitorId, tenantContext.userId);
  return null;
}

async function updateMonitor(
  monitorId: string,
  tenantContext: TenantContext,
  updates: UpdateMonitorRequest
): Promise<Monitor> {
  // TODO: Update in database
  console.log('Updating monitor:', monitorId, tenantContext.userId, updates);

  // Return mock updated monitor
  return {
    id: monitorId,
    userId: tenantContext.userId,
    tenantId: tenantContext.tenantId,
    repoUrl: 'https://github.com/example/repo',
    pollIntervalHours: updates.pollIntervalHours || 24,
    webhookUrl: updates.webhookUrl,
    notifyOn: updates.notifyOn || ['architecture-change'],
    status: updates.status || 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function deleteMonitor(
  monitorId: string,
  tenantContext: TenantContext
): Promise<void> {
  // TODO: Soft delete in database
  console.log('Deleting monitor:', monitorId, tenantContext.userId);
}

async function triggerMonitorCheck(
  monitor: Monitor,
  tenantContext: TenantContext
): Promise<{
  triggered: boolean;
  analysisId?: string;
  changes?: boolean;
}> {
  // TODO: Trigger actual check
  console.log('Triggering monitor check:', monitor.id, tenantContext.userId);

  return {
    triggered: true,
    analysisId: uuidv4(),
    changes: false,
  };
}

async function getMonitorHistory(
  monitorId: string,
  limit: number,
  offset: number
): Promise<{
  items: Array<{
    checkId: string;
    checkedAt: Date;
    commitHash: string;
    changesDetected: boolean;
    analysisId?: string;
  }>;
  total: number;
  hasMore: boolean;
}> {
  // TODO: Query database
  console.log('Getting monitor history:', monitorId, limit, offset);
  return { items: [], total: 0, hasMore: false };
}

export default router;
