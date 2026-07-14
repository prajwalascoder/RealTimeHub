import http from 'http';
import app from './app.js';
import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { createRedisClient, disconnectRedis } from './config/redis.js';
import { initializeSocket } from './sockets/index.js';

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Connect to Redis
    const redis = createRedisClient();
    await redis.connect();

    // Create HTTP server
    const httpServer = http.createServer(app);

    // Initialize Socket.IO
    initializeSocket(httpServer);

    // Start listening
    httpServer.listen(config.PORT, () => {
      logger.info(`🚀 Server running on port ${config.PORT}`);
      logger.info(`📝 API Docs: http://localhost:${config.PORT}/api-docs`);
      logger.info(`📊 Metrics: http://localhost:${config.PORT}/metrics`);
      logger.info(`❤️  Health: http://localhost:${config.PORT}/health`);
      logger.info(`🌍 Environment: ${config.NODE_ENV}`);
    });

    // ─── Graceful Shutdown ──────────────────────────────
    const gracefulShutdown = async (signal: string) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);

      httpServer.close(async () => {
        logger.info('HTTP server closed');

        try {
          await disconnectDatabase();
          await disconnectRedis();
          logger.info('All connections closed. Goodbye! 👋');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason: Error) => {
      logger.error('Unhandled Rejection:', reason);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
