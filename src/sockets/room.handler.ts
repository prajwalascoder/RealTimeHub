import { Server, Socket } from 'socket.io';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './types.js';
import { Conversation } from '../models/conversation.model.js';
import { logger } from '../config/logger.js';
import mongoose from 'mongoose';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Auto-join user to all their conversation rooms on connect
 */
export const joinUserRooms = async (socket: TypedSocket): Promise<void> => {
  const userId = socket.data.userId;

  const conversations = await Conversation.find({
    participants: new mongoose.Types.ObjectId(userId),
  }).select('_id');

  for (const conv of conversations) {
    await socket.join(conv._id.toString());
  }

  logger.debug(`User ${userId} joined ${conversations.length} rooms`);
};

export const registerRoomHandlers = (_io: TypedServer, socket: TypedSocket) => {
  // ─── Join a specific conversation room ────────────────
  socket.on('conversation:join', async (data) => {
    try {
      const { conversationId } = data;
      const userId = socket.data.userId;

      // Verify user is a participant
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: new mongoose.Types.ObjectId(userId),
      });

      if (!conversation) {
        socket.emit('error', { message: 'Cannot join this conversation' });
        return;
      }

      await socket.join(conversationId);
      logger.debug(`User ${userId} joined room ${conversationId}`);
    } catch (error) {
      logger.error('Socket conversation:join error:', error);
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  });

  // ─── Leave a specific conversation room ───────────────
  socket.on('conversation:leave', async (data) => {
    try {
      const { conversationId } = data;
      const userId = socket.data.userId;

      await socket.leave(conversationId);
      logger.debug(`User ${userId} left room ${conversationId}`);
    } catch (error) {
      logger.error('Socket conversation:leave error:', error);
    }
  });
};
