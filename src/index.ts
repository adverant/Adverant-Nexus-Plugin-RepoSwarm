/**
 * RepoSwarm - AI-Powered Repository Analysis Plugin
 * Entry point for the Nexus marketplace plugin
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';

import { analysisRoutes, monitoringRoutes, webhooksRoutes } from './routes';

// Environment configuration
const PORT = parseInt(process.env.PORT || '9200', 10);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const SERVICE_NAME = 'nexus-reposwarm';
const VERSION = process.env.NEXUS_VERSION || '1.0.0';
const BUILD_ID = process.env.NEXUS_BUILD_ID || 'dev';

// Initialize Express app
const app = express();

// Trust proxy for accurate IP addresses behind reverse proxy
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production',
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-Id',
    'X-User-Id',
    'X-Tenant-Id',
    'X-Company-Id',
    'X-App-Id',
    'X-Session-Id',
  ],
}));

// Body parsing and compression
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  next();
});

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'];

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      service: SERVICE_NAME,
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    }));
  });

  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: SERVICE_NAME,
    version: VERSION,
    buildId: BUILD_ID,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks: [
      { name: 'express', status: 'pass' },
      { name: 'memory', status: 'pass', latency: getMemoryUsage() },
    ],
  });
});

// Readiness check endpoint
app.get('/ready', (_req: Request, res: Response) => {
  res.json({
    ready: true,
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
  });
});

// Liveness check endpoint
app.get('/live', (_req: Request, res: Response) => {
  res.json({
    alive: true,
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
  });
});

// Plugin info endpoint
app.get('/info', (_req: Request, res: Response) => {
  res.json({
    name: SERVICE_NAME,
    displayName: 'RepoSwarm - AI Repository Analyzer',
    version: VERSION,
    buildId: BUILD_ID,
    description: 'AI-powered repository analysis and architecture discovery platform',
    developer: {
      name: 'Adverant',
      url: 'https://adverant.ai',
      email: 'plugins@adverant.ai',
    },
    capabilities: [
      'repository-analysis',
      'architecture-discovery',
      'security-scanning',
      'continuous-monitoring',
    ],
    endpoints: {
      analysis: '/api/v1/reposwarm',
      monitors: '/api/v1/reposwarm/monitors',
      webhooks: '/api/v1/reposwarm/webhooks',
    },
  });
});

// API routes
app.use('/api/v1/reposwarm', analysisRoutes);
app.use('/api/v1/reposwarm/monitors', monitoringRoutes);
app.use('/api/v1/reposwarm/webhooks', webhooksRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
    },
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = req.headers['x-request-id'];

  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    requestId,
    error: err.message,
    stack: NODE_ENV === 'development' ? err.stack : undefined,
  }));

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: NODE_ENV === 'production' ? 'An internal error occurred' : err.message,
      requestId,
    },
  });
});

// Helper function to get memory usage
function getMemoryUsage(): number {
  const usage = process.memoryUsage();
  return Math.round(usage.heapUsed / 1024 / 1024);
}

// Graceful shutdown handler
function shutdown(signal: string): void {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
}

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    event: 'startup',
    message: `RepoSwarm server started`,
    host: HOST,
    port: PORT,
    version: VERSION,
    buildId: BUILD_ID,
    nodeEnv: NODE_ENV,
  }));
});

// Handle graceful shutdown
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    event: 'uncaughtException',
    error: error.message,
    stack: error.stack,
  }));
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    event: 'unhandledRejection',
    reason: String(reason),
  }));
});

export default app;
