/**
 * Webhook API Routes for RepoSwarm
 * Handles webhook configuration and delivery
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import axios from 'axios';
import {
  TenantContext,
  WebhookConfig,
  WebhookEvent,
  WebhookPayload,
} from '../types';

const router = Router();

// Types for request/response
interface WebhookConfigRequest {
  url: string;
  events: WebhookEvent[];
  secret?: string;
  headers?: Record<string, string>;
  retryCount?: number;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: unknown;
  status: 'pending' | 'delivered' | 'failed';
  responseStatus?: number;
  responseBody?: string;
  attempts: number;
  createdAt: Date;
  deliveredAt?: Date;
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
 * POST /webhooks
 * Register a new webhook endpoint
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const body = req.body as WebhookConfigRequest;

    // Validate URL
    if (!body.url) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_URL',
          message: 'Webhook URL is required',
        },
      });
      return;
    }

    // Validate URL format
    try {
      new URL(body.url);
    } catch {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: 'Invalid webhook URL format',
        },
      });
      return;
    }

    // Validate events
    if (!body.events || body.events.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_EVENTS',
          message: 'At least one event type is required',
        },
      });
      return;
    }

    const validEvents: WebhookEvent[] = [
      'analysis.started',
      'analysis.progress',
      'analysis.completed',
      'analysis.failed',
      'monitor.triggered',
      'monitor.change_detected',
    ];

    const invalidEvents = body.events.filter((e) => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EVENTS',
          message: `Invalid event types: ${invalidEvents.join(', ')}`,
          details: { validEvents },
        },
      });
      return;
    }

    // Generate secret if not provided
    const secret = body.secret || generateWebhookSecret();

    // Create webhook configuration
    const webhook = await createWebhook({
      userId: tenantContext.userId,
      tenantId: tenantContext.tenantId,
      url: body.url,
      events: body.events,
      secret,
      headers: body.headers,
      retryCount: body.retryCount || 3,
    });

    res.status(201).json({
      success: true,
      data: {
        ...webhook,
        secret: secret, // Only returned on creation
      },
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Create webhook failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_WEBHOOK_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create webhook',
      },
    });
  }
});

/**
 * GET /webhooks
 * List all webhook configurations
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;

    const webhooks = await listWebhooks(tenantContext);

    res.json({
      success: true,
      data: webhooks,
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('List webhooks failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_WEBHOOKS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to list webhooks',
      },
    });
  }
});

/**
 * GET /webhooks/:webhookId
 * Get a specific webhook configuration
 */
router.get('/:webhookId', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { webhookId } = req.params;

    const webhook = await getWebhook(webhookId, tenantContext);

    if (!webhook) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: `Webhook ${webhookId} not found`,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: webhook,
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Get webhook failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_WEBHOOK_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get webhook',
      },
    });
  }
});

/**
 * PATCH /webhooks/:webhookId
 * Update a webhook configuration
 */
router.patch('/:webhookId', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { webhookId } = req.params;
    const body = req.body as Partial<WebhookConfigRequest>;

    const existing = await getWebhook(webhookId, tenantContext);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: `Webhook ${webhookId} not found`,
        },
      });
      return;
    }

    // Validate URL if provided
    if (body.url) {
      try {
        new URL(body.url);
      } catch {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_URL',
            message: 'Invalid webhook URL format',
          },
        });
        return;
      }
    }

    const updated = await updateWebhook(webhookId, tenantContext, body);

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
    console.error('Update webhook failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_WEBHOOK_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update webhook',
      },
    });
  }
});

/**
 * DELETE /webhooks/:webhookId
 * Delete a webhook configuration
 */
router.delete('/:webhookId', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { webhookId } = req.params;

    const existing = await getWebhook(webhookId, tenantContext);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: `Webhook ${webhookId} not found`,
        },
      });
      return;
    }

    await deleteWebhook(webhookId, tenantContext);

    res.json({
      success: true,
      data: {
        deleted: true,
        webhookId,
      },
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Delete webhook failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_WEBHOOK_FAILED',
        message: error instanceof Error ? error.message : 'Failed to delete webhook',
      },
    });
  }
});

/**
 * POST /webhooks/:webhookId/test
 * Send a test webhook
 */
router.post('/:webhookId/test', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { webhookId } = req.params;

    const webhook = await getWebhook(webhookId, tenantContext);
    if (!webhook) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: `Webhook ${webhookId} not found`,
        },
      });
      return;
    }

    // Send test payload
    const testPayload: WebhookPayload = {
      event: 'analysis.completed',
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook from RepoSwarm',
        webhookId,
      },
    };

    const result = await deliverWebhook(webhook, testPayload);

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
    console.error('Test webhook failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TEST_WEBHOOK_FAILED',
        message: error instanceof Error ? error.message : 'Failed to test webhook',
      },
    });
  }
});

/**
 * GET /webhooks/:webhookId/deliveries
 * Get webhook delivery history
 */
router.get('/:webhookId/deliveries', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { webhookId } = req.params;
    const { limit = '50', offset = '0', status } = req.query;

    const webhook = await getWebhook(webhookId, tenantContext);
    if (!webhook) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: `Webhook ${webhookId} not found`,
        },
      });
      return;
    }

    const deliveries = await getDeliveries(
      webhookId,
      parseInt(limit as string, 10),
      parseInt(offset as string, 10),
      status as 'pending' | 'delivered' | 'failed' | undefined
    );

    res.json({
      success: true,
      data: deliveries,
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Get deliveries failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_DELIVERIES_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get deliveries',
      },
    });
  }
});

/**
 * POST /webhooks/:webhookId/deliveries/:deliveryId/retry
 * Retry a failed webhook delivery
 */
router.post('/:webhookId/deliveries/:deliveryId/retry', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { webhookId, deliveryId } = req.params;

    const webhook = await getWebhook(webhookId, tenantContext);
    if (!webhook) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: `Webhook ${webhookId} not found`,
        },
      });
      return;
    }

    const delivery = await getDelivery(deliveryId);
    if (!delivery) {
      res.status(404).json({
        success: false,
        error: {
          code: 'DELIVERY_NOT_FOUND',
          message: `Delivery ${deliveryId} not found`,
        },
      });
      return;
    }

    // Retry the delivery
    const result = await retryDelivery(webhook, delivery);

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
    console.error('Retry delivery failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RETRY_DELIVERY_FAILED',
        message: error instanceof Error ? error.message : 'Failed to retry delivery',
      },
    });
  }
});

/**
 * POST /webhooks/:webhookId/rotate-secret
 * Rotate the webhook signing secret
 */
router.post('/:webhookId/rotate-secret', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantContext = (req as Request & { tenantContext: TenantContext }).tenantContext;
    const { webhookId } = req.params;

    const webhook = await getWebhook(webhookId, tenantContext);
    if (!webhook) {
      res.status(404).json({
        success: false,
        error: {
          code: 'WEBHOOK_NOT_FOUND',
          message: `Webhook ${webhookId} not found`,
        },
      });
      return;
    }

    const newSecret = generateWebhookSecret();
    await updateWebhook(webhookId, tenantContext, { secret: newSecret });

    res.json({
      success: true,
      data: {
        secret: newSecret,
        rotatedAt: new Date().toISOString(),
      },
      meta: {
        requestId: tenantContext.requestId || '',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    console.error('Rotate secret failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROTATE_SECRET_FAILED',
        message: error instanceof Error ? error.message : 'Failed to rotate secret',
      },
    });
  }
});

// Helper functions

function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

function signPayload(payload: unknown, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify(payload);
  const signaturePayload = `${timestamp}.${payloadString}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex');

  return `t=${timestamp},v1=${signature}`;
}

interface WebhookInput {
  userId: string;
  tenantId: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  headers?: Record<string, string>;
  retryCount: number;
}

interface StoredWebhook extends WebhookConfig {
  id: string;
  userId: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

async function createWebhook(input: WebhookInput): Promise<StoredWebhook> {
  // TODO: Insert into database
  const webhook: StoredWebhook = {
    id: uuidv4(),
    userId: input.userId,
    tenantId: input.tenantId,
    url: input.url,
    events: input.events,
    secret: input.secret,
    headers: input.headers,
    retryCount: input.retryCount,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  console.log('Created webhook:', webhook.id);
  return webhook;
}

async function listWebhooks(
  tenantContext: TenantContext
): Promise<StoredWebhook[]> {
  // TODO: Query database
  console.log('Listing webhooks for:', tenantContext.userId);
  return [];
}

async function getWebhook(
  webhookId: string,
  tenantContext: TenantContext
): Promise<StoredWebhook | null> {
  // TODO: Query database
  console.log('Getting webhook:', webhookId, tenantContext.userId);
  return null;
}

async function updateWebhook(
  webhookId: string,
  tenantContext: TenantContext,
  updates: Partial<WebhookConfigRequest>
): Promise<StoredWebhook> {
  // TODO: Update in database
  console.log('Updating webhook:', webhookId, tenantContext.userId, updates);

  return {
    id: webhookId,
    userId: tenantContext.userId,
    tenantId: tenantContext.tenantId,
    url: updates.url || 'https://example.com/webhook',
    events: updates.events || ['analysis.completed'],
    retryCount: updates.retryCount || 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function deleteWebhook(
  webhookId: string,
  tenantContext: TenantContext
): Promise<void> {
  // TODO: Delete from database
  console.log('Deleting webhook:', webhookId, tenantContext.userId);
}

async function deliverWebhook(
  webhook: StoredWebhook,
  payload: WebhookPayload
): Promise<{
  delivered: boolean;
  statusCode?: number;
  error?: string;
  duration: number;
}> {
  const startTime = Date.now();

  try {
    const signature = webhook.secret ? signPayload(payload, webhook.secret) : undefined;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'RepoSwarm-Webhook/1.0',
      ...(webhook.headers || {}),
    };

    if (signature) {
      headers['X-RepoSwarm-Signature'] = signature;
    }

    const response = await axios.post(webhook.url, payload, {
      headers,
      timeout: 30000,
    });

    return {
      delivered: true,
      statusCode: response.status,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      delivered: false,
      statusCode: axios.isAxiosError(error) ? error.response?.status : undefined,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

async function getDeliveries(
  webhookId: string,
  limit: number,
  offset: number,
  status?: 'pending' | 'delivered' | 'failed'
): Promise<{ items: WebhookDelivery[]; total: number; hasMore: boolean }> {
  // TODO: Query database
  console.log('Getting deliveries:', webhookId, limit, offset, status);
  return { items: [], total: 0, hasMore: false };
}

async function getDelivery(deliveryId: string): Promise<WebhookDelivery | null> {
  // TODO: Query database
  console.log('Getting delivery:', deliveryId);
  return null;
}

async function retryDelivery(
  webhook: StoredWebhook,
  delivery: WebhookDelivery
): Promise<{
  delivered: boolean;
  statusCode?: number;
  error?: string;
}> {
  // Recreate payload and retry
  const payload: WebhookPayload = {
    event: delivery.event,
    timestamp: new Date().toISOString(),
    data: delivery.payload,
  };

  const result = await deliverWebhook(webhook, payload);

  // TODO: Update delivery status in database

  return result;
}

// Export the webhook delivery function for use by other modules
export async function sendWebhook(
  url: string,
  event: WebhookEvent,
  data: unknown,
  secret?: string
): Promise<boolean> {
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'RepoSwarm-Webhook/1.0',
    };

    if (secret) {
      headers['X-RepoSwarm-Signature'] = signPayload(payload, secret);
    }

    await axios.post(url, payload, {
      headers,
      timeout: 30000,
    });

    return true;
  } catch (error) {
    console.error('Webhook delivery failed:', error);
    return false;
  }
}

export default router;
