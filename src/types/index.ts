/**
 * Type exports for RepoSwarm
 */

export * from './repository';
export * from './analysis';
export * from './prompts';

/**
 * Tenant context for multi-tenant isolation
 */
export interface TenantContext {
  userId: string;
  tenantId: string;
  companyId?: string;
  appId?: string;
  sessionId?: string;
  requestId?: string;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    version: string;
  };
}

/**
 * Pagination
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  url: string;
  events: WebhookEvent[];
  secret?: string;
  headers?: Record<string, string>;
  retryCount?: number;
}

export type WebhookEvent =
  | 'analysis.started'
  | 'analysis.progress'
  | 'analysis.completed'
  | 'analysis.failed'
  | 'monitor.triggered'
  | 'monitor.change_detected';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: unknown;
  signature?: string;
}

/**
 * Monitor configuration
 */
export interface Monitor {
  id: string;
  userId: string;
  tenantId: string;
  repoUrl: string;
  branch?: string;
  pollIntervalHours: number;
  webhookUrl?: string;
  notifyOn: MonitorNotification[];
  status: MonitorStatus;
  lastCheckAt?: Date;
  lastCommitHash?: string;
  nextCheckAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type MonitorStatus = 'active' | 'paused' | 'deleted';

export type MonitorNotification =
  | 'architecture-change'
  | 'security-issue'
  | 'new-dependency'
  | 'any-change';

/**
 * Subscription tier for billing
 */
export interface SubscriptionTier {
  id: string;
  name: 'free' | 'starter' | 'professional' | 'enterprise';
  limits: TierLimits;
}

export interface TierLimits {
  analysisPerMonth: number;  // -1 for unlimited
  maxRepoSizeBytes: number;
  maxMonitors: number;
  features: string[];
}

/**
 * Usage tracking
 */
export interface UsageRecord {
  userId: string;
  tenantId: string;
  pluginId: string;
  operation: string;
  timestamp: Date;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    durationMs?: number;
    customMetrics?: Record<string, number>;
  };
}

/**
 * Service health
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  buildId?: string;
  uptime: number;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail';
  message?: string;
  latency?: number;
}
