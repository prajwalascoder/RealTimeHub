import { getRedisClient } from '../config/redis.js';
import { REDIS_KEYS, REDIS_TTL } from '../utils/constants.js';
import { logger } from '../config/logger.js';

export class RedisService {
  private get redis() {
    return getRedisClient();
  }

  // ─── Online User Tracking ─────────────────────────────

  async setUserOnline(userId: string, socketId: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.sadd(REDIS_KEYS.ONLINE_USERS, userId);
    pipeline.set(`${REDIS_KEYS.USER_SOCKET}${userId}`, socketId);
    pipeline.set(`${REDIS_KEYS.SOCKET_USER}${socketId}`, userId);
    await pipeline.exec();
    logger.debug(`User ${userId} is now online (socket: ${socketId})`);
  }

  async setUserOffline(userId: string, socketId: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.srem(REDIS_KEYS.ONLINE_USERS, userId);
    pipeline.del(`${REDIS_KEYS.USER_SOCKET}${userId}`);
    pipeline.del(`${REDIS_KEYS.SOCKET_USER}${socketId}`);
    await pipeline.exec();
    logger.debug(`User ${userId} is now offline`);
  }

  async getOnlineUsers(): Promise<string[]> {
    return this.redis.smembers(REDIS_KEYS.ONLINE_USERS);
  }

  async isUserOnline(userId: string): Promise<boolean> {
    return (await this.redis.sismember(REDIS_KEYS.ONLINE_USERS, userId)) === 1;
  }

  async getUserSocketId(userId: string): Promise<string | null> {
    return this.redis.get(`${REDIS_KEYS.USER_SOCKET}${userId}`);
  }

  async getSocketUserId(socketId: string): Promise<string | null> {
    return this.redis.get(`${REDIS_KEYS.SOCKET_USER}${socketId}`);
  }

  // ─── Session Management ───────────────────────────────

  async setUserSession(userId: string, data: Record<string, unknown>): Promise<void> {
    await this.redis.set(
      `${REDIS_KEYS.USER_SESSION}${userId}`,
      JSON.stringify(data),
      'EX',
      REDIS_TTL.USER_SESSION,
    );
  }

  async getUserSession(userId: string): Promise<Record<string, unknown> | null> {
    const data = await this.redis.get(`${REDIS_KEYS.USER_SESSION}${userId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteUserSession(userId: string): Promise<void> {
    await this.redis.del(`${REDIS_KEYS.USER_SESSION}${userId}`);
  }

  // ─── Caching ──────────────────────────────────────────

  async cacheGet<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async cacheSet(key: string, data: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  }

  async cacheInvalidate(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async cacheInvalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // ─── Typing Indicators ────────────────────────────────

  async setTyping(conversationId: string, userId: string): Promise<void> {
    await this.redis.set(
      `${REDIS_KEYS.TYPING}${conversationId}:${userId}`,
      '1',
      'EX',
      REDIS_TTL.TYPING,
    );
  }

  async removeTyping(conversationId: string, userId: string): Promise<void> {
    await this.redis.del(`${REDIS_KEYS.TYPING}${conversationId}:${userId}`);
  }
}

export const redisService = new RedisService();
