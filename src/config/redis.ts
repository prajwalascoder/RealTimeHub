import Redis from 'ioredis';
import { config } from './index.js';
import { logger } from './logger.js';

let redisClient: Redis;

export const createRedisClient = (): Redis => {
  redisClient = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 3000);
      logger.warn(`Redis reconnecting... attempt ${times}, delay: ${delay}ms`);
      return delay;
    },
    lazyConnect: true,
  });

  redisClient.on('connect', () => {
    logger.info('🔴 Redis connected successfully');
  });

  redisClient.on('error', (err) => {
    logger.error('Redis connection error:', err);
  });

  redisClient.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return redisClient;
};

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call createRedisClient() first.');
  }
  return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis disconnected gracefully');
  }
};
