import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';
import { activeSocketConnections } from '../sockets/index.js';
import { logger } from '../config/logger.js';

// Collect default Node.js metrics (CPU, memory, event loop, GC)
client.collectDefaultMetrics({ prefix: 'realtimehub_' });

// ─── Custom Metrics ─────────────────────────────────────

// HTTP request duration histogram
const httpRequestDuration = new client.Histogram({
  name: 'realtimehub_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// HTTP request counter
const httpRequestsTotal = new client.Counter({
  name: 'realtimehub_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
});

// Active WebSocket connections gauge
const activeWebsocketConnections = new client.Gauge({
  name: 'realtimehub_active_websocket_connections',
  help: 'Number of active WebSocket connections',
  collect() {
    this.set(activeSocketConnections);
  },
});

// Messages sent counter
export const messagesSentTotal = new client.Counter({
  name: 'realtimehub_messages_sent_total',
  help: 'Total number of messages sent',
  labelNames: ['type'] as const,
});

// Active users gauge
const activeUsersTotal = new client.Gauge({
  name: 'realtimehub_active_users_total',
  help: 'Number of currently online users',
});

// Export for updating from other modules
export const setActiveUsers = (count: number) => {
  activeUsersTotal.set(count);
};

// ─── Metrics Middleware ─────────────────────────────────

export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Skip metrics endpoint itself
  if (req.path === '/metrics') {
    return next();
  }

  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    // Normalize route paths to avoid metric explosion from dynamic params
    const route = req.route?.path || req.path.replace(/\/[a-f0-9]{24}/g, '/:id');

    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode.toString(),
    };

    end(labels);
    httpRequestsTotal.inc(labels);
  });

  next();
};

// ─── Metrics Endpoint Handler ───────────────────────────

export const metricsHandler = async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', client.register.contentType);
    const metrics = await client.register.metrics();
    res.end(metrics);
  } catch (error) {
    logger.error('Failed to generate metrics:', error);
    res.status(500).end('Failed to generate metrics');
  }
};

// Keep reference to avoid unused variable warnings
void activeWebsocketConnections;
