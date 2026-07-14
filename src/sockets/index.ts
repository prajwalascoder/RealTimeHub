import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './types.js';
import { registerChatHandlers } from './chat.handler.js';
import { registerPresenceHandlers, handleUserOnline, handleUserOffline } from './presence.handler.js';
import { registerRoomHandlers, joinUserRooms } from './room.handler.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { User } from '../models/user.model.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

// Custom metrics counter — will be updated by the metrics middleware
export let activeSocketConnections = 0;

export const initializeSocket = (
  httpServer: HttpServer,
): Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> => {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: config.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    },
    maxHttpBufferSize: 1e7, // 10MB to match Express body limit
  });

  // ─── Authentication Middleware ─────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token is required'));
      }

      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId).select('username email');

      if (!user) {
        return next(new Error('User not found'));
      }

      // Attach user data to socket
      socket.data.userId = user._id.toString();
      socket.data.email = user.email;
      socket.data.username = user.username;

      next();
    } catch (error) {
      logger.error('Socket authentication failed:', error);
      next(new Error('Authentication failed'));
    }
  });

  // ─── Connection Handler ───────────────────────────────
  io.on('connection', async (socket) => {
    activeSocketConnections++;
    logger.info(`Socket connected: ${socket.id} (user: ${socket.data.userId})`);

    try {
      // Handle user coming online
      await handleUserOnline(io, socket);

      // Auto-join user's conversation rooms
      await joinUserRooms(socket);

      // Register event handlers
      registerChatHandlers(io, socket);
      registerPresenceHandlers(io, socket);
      registerRoomHandlers(io, socket);
    } catch (error) {
      logger.error('Socket connection setup error:', error);
      socket.emit('error', { message: 'Connection setup failed' });
    }

    // ─── Disconnect Handler ─────────────────────────────
    socket.on('disconnect', async (reason) => {
      activeSocketConnections--;
      logger.info(`Socket disconnected: ${socket.id} (reason: ${reason})`);

      try {
        await handleUserOffline(io, socket);
      } catch (error) {
        logger.error('Socket disconnect cleanup error:', error);
      }
    });

    // ─── Error Handler ──────────────────────────────────
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  logger.info('🔌 Socket.IO initialized');

  return io;
};
