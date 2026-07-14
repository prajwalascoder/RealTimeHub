import { Server, Socket } from 'socket.io';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from './types.js';
import { chatService } from '../services/chat.service.js';
import { redisService } from '../services/redis.service.js';
import { logger } from '../config/logger.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export const registerChatHandlers = (io: TypedServer, socket: TypedSocket) => {
  // ─── Send Message ─────────────────────────────────────
  socket.on('message:send', async (data, ack) => {
    try {
      const { conversationId, content, type } = data;
      const userId = socket.data.userId;

      const message = await chatService.sendMessage(
        conversationId,
        userId,
        content,
        (type as 'text' | 'image' | 'file') || 'text',
      );

      // Broadcast to conversation room (excluding sender)
      socket.to(conversationId).emit('message:new', message);

      // Acknowledge to sender
      ack({ success: true, message });

      // Send delivery acknowledgements to sender for other online participants
      const conversation = await chatService.getConversation(conversationId, userId);
      for (const participant of conversation.participants) {
        const participantId = participant._id.toString();
        if (participantId !== userId) {
          const isOnline = await redisService.isUserOnline(participantId);
          if (isOnline) {
            socket.emit('message:delivered', {
              messageId: message._id.toString(),
              conversationId,
            });
          }
        }
      }

      logger.debug(`Message sent by ${userId} in ${conversationId}`);
    } catch (error) {
      logger.error('Socket message:send error:', error);
      ack({ success: false, error: (error as Error).message });
    }
  });

  // ─── Edit Message ─────────────────────────────────────
  socket.on('message:edit', async (data, ack) => {
    try {
      const { messageId, content } = data;
      const userId = socket.data.userId;

      const message = await chatService.editMessage(messageId, userId, content);

      // Broadcast to conversation room
      socket
        .to(message.conversationId.toString())
        .emit('message:updated', message);

      ack({ success: true, message });

      logger.debug(`Message ${messageId} edited by ${userId}`);
    } catch (error) {
      logger.error('Socket message:edit error:', error);
      ack({ success: false, error: (error as Error).message });
    }
  });

  // ─── Delete Message ───────────────────────────────────
  socket.on('message:delete', async (data, ack) => {
    try {
      const { messageId } = data;
      const userId = socket.data.userId;

      const message = await chatService.deleteMessage(messageId, userId);

      // Broadcast to conversation room
      socket.to(message.conversationId.toString()).emit('message:deleted', {
        messageId,
        conversationId: message.conversationId.toString(),
      });

      ack({ success: true });

      logger.debug(`Message ${messageId} deleted by ${userId}`);
    } catch (error) {
      logger.error('Socket message:delete error:', error);
      ack({ success: false, error: (error as Error).message });
    }
  });

  // ─── Read Receipt ─────────────────────────────────────
  socket.on('message:read', async (data) => {
    try {
      const { conversationId } = data;
      const userId = socket.data.userId;

      await chatService.markAsRead(conversationId, userId);

      // Notify other participants
      socket.to(conversationId).emit('message:read', {
        conversationId,
        userId,
        readAt: new Date().toISOString(),
      });

      logger.debug(`Messages read by ${userId} in ${conversationId}`);
    } catch (error) {
      logger.error('Socket message:read error:', error);
    }
  });
};
