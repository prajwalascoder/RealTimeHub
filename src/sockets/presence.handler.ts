import { Server, Socket } from 'socket.io';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './types.js';
import { redisService } from '../services/redis.service.js';
import { userService } from '../services/user.service.js';
import { logger } from '../config/logger.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export const registerPresenceHandlers = (io: TypedServer, socket: TypedSocket) => {
  // ─── Typing Start ─────────────────────────────────────
  socket.on('typing:start', async (data) => {
    try {
      const { conversationId } = data;
      const userId = socket.data.userId;
      const username = socket.data.username;

      await redisService.setTyping(conversationId, userId);

      socket.to(conversationId).emit('user:typing', {
        conversationId,
        userId,
        username,
      });
    } catch (error) {
      logger.error('Socket typing:start error:', error);
    }
  });

  // ─── Typing Stop ──────────────────────────────────────
  socket.on('typing:stop', async (data) => {
    try {
      const { conversationId } = data;
      const userId = socket.data.userId;

      await redisService.removeTyping(conversationId, userId);

      socket.to(conversationId).emit('user:stop-typing', {
        conversationId,
        userId,
      });
    } catch (error) {
      logger.error('Socket typing:stop error:', error);
    }
  });
};

/**
 * Handle user coming online
 */
export const handleUserOnline = async (
  io: TypedServer,
  socket: TypedSocket,
): Promise<void> => {
  const userId = socket.data.userId;

  await redisService.setUserOnline(userId, socket.id);
  await userService.updateOnlineStatus(userId, 'online');

  // Broadcast to all connected users
  socket.broadcast.emit('user:online', { userId });

  logger.info(`User online: ${userId} (socket: ${socket.id})`);
};

/**
 * Handle user going offline
 */
export const handleUserOffline = async (
  io: TypedServer,
  socket: TypedSocket,
): Promise<void> => {
  const userId = socket.data.userId;

  await redisService.setUserOffline(userId, socket.id);
  await userService.updateOnlineStatus(userId, 'offline');

  const lastSeen = new Date().toISOString();

  // Broadcast to all connected users
  socket.broadcast.emit('user:offline', { userId, lastSeen });

  logger.info(`User offline: ${userId}`);
};
