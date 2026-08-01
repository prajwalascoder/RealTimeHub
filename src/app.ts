import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/index.js';
import { stream } from './config/logger.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { metricsMiddleware, metricsHandler } from './middlewares/metrics.middleware.js';
import { swaggerSpec } from './docs/swagger.js';
import { getRedisClient } from './config/redis.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import chatRoutes from './routes/chat.routes.js';
import groupRoutes from './routes/group.routes.js';

const app = express();

// ─── Security ───────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ─── Body Parsing ───────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ────────────────────────────────────────────
app.use(morgan('combined', { stream }));

// ─── Prometheus Metrics ─────────────────────────────────
app.use(metricsMiddleware);

// ─── Health Check ───────────────────────────────────────
app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Check MongoDB
  try {
    const mongoState = mongoose.connection.readyState;
    checks.mongodb = mongoState === 1 ? 'connected' : 'disconnected';
    if (mongoState !== 1) healthy = false;
  } catch {
    checks.mongodb = 'error';
    healthy = false;
  }

  // Check Redis
  try {
    const redis = getRedisClient();
    await redis.ping();
    checks.redis = 'connected';
  } catch {
    checks.redis = 'error';
    healthy = false;
  }

  const statusCode = healthy ? 200 : 503;
  res.status(statusCode).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  });
});

// ─── Metrics Endpoint ───────────────────────────────────
app.get('/metrics', (req, res) => {
  if (config.NODE_ENV === 'production' && config.METRICS_TOKEN) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token !== config.METRICS_TOKEN) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
  }
  metricsHandler(req, res);
});

// ─── API Documentation ─────────────────────────────────
if (config.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'RealtimeHub API Docs',
  }));
}

// ─── API Routes ─────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/groups', groupRoutes);

// ─── Root Route (Service Info) ──────────────────────────
app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'RealtimeHub API',
    version: '1.0.0',
    status: 'running',
    docs: '/api-docs',
    health: '/health',
  });
});

// ─── 404 Handler ────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: 'Route not found',
  });
});

// ─── Global Error Handler ───────────────────────────────
app.use(errorHandler);

export default app;
