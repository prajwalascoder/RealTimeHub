import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import { Conversation, IConversation } from '../models/conversation.model.js';
import { Message, IMessage } from '../models/message.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../utils/constants.js';
import { logger } from '../config/logger.js';

export class ChatService {
  /**
   * Create or retrieve an existing 1:1 conversation between two users
   */
  async createOrGetConversation(
    userId: string,
    targetUserId: string,
  ): Promise<IConversation> {
    if (userId === targetUserId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Cannot create conversation with yourself');
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Target user not found');
    }

    // Check for existing direct conversation
    const existingConversation = await Conversation.findOne({
      type: 'direct',
      participants: {
        $all: [
          new mongoose.Types.ObjectId(userId),
          new mongoose.Types.ObjectId(targetUserId),
        ],
        $size: 2,
      },
    }).populate('participants', 'username displayName avatar status lastSeen');

    if (existingConversation) {
      return existingConversation;
    }

    // Create new conversation
    const conversation = await Conversation.create({
      type: 'direct',
      participants: [userId, targetUserId],
    });

    const populated = await conversation.populate(
      'participants',
      'username displayName avatar status lastSeen',
    );

    logger.info(`Conversation created between ${userId} and ${targetUserId}`);
    return populated;
  }

  /**
   * Get a conversation by ID (with authorization check)
   */
  async getConversation(
    conversationId: string,
    userId: string,
  ): Promise<IConversation> {
    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'username displayName avatar status lastSeen');

    if (!conversation) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Conversation not found');
    }

    // Check if user is a participant
    const isParticipant = conversation.participants.some(
      (p) => p._id.toString() === userId,
    );

    if (!isParticipant) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Access denied');
    }

    return conversation;
  }

  /**
   * Get all conversations for a user, sorted by last activity
   */
  async getUserConversations(userId: string): Promise<IConversation[]> {
    const conversations = await Conversation.find({
      participants: new mongoose.Types.ObjectId(userId),
    })
      .populate('participants', 'username displayName avatar status lastSeen')
      .sort({ updatedAt: -1 });

    return conversations;
  }

  /**
   * Get messages for a conversation with cursor-based pagination
   */
  async getMessages(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit: number = DEFAULT_PAGE_SIZE,
  ): Promise<{ messages: IMessage[]; nextCursor: string | null; hasMore: boolean }> {
    // Verify access
    await this.getConversation(conversationId, userId);

    const safeLimit = Math.min(limit, MAX_PAGE_SIZE);

    const query: Record<string, unknown> = {
      conversationId: new mongoose.Types.ObjectId(conversationId),
      deletedAt: null,
    };

    // Cursor-based: fetch messages older than the cursor
    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    const messages = await Message.find(query)
      .populate('sender', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .limit(safeLimit + 1)
      .lean();

    const hasMore = messages.length > safeLimit;
    const resultMessages = hasMore ? messages.slice(0, safeLimit) : messages;
    const nextCursor = hasMore
      ? (resultMessages[resultMessages.length - 1] as IMessage).createdAt.toISOString()
      : null;

    return {
      messages: resultMessages as IMessage[],
      nextCursor,
      hasMore,
    };
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: 'text' | 'image' | 'file' = 'text',
  ): Promise<IMessage> {
    // Verify access
    await this.getConversation(conversationId, senderId);

    const message = await Message.create({
      conversationId,
      sender: senderId,
      content,
      type,
      status: 'sent',
    });

    // Update conversation's last message
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: {
        content: content.substring(0, 100),
        sender: new mongoose.Types.ObjectId(senderId),
        timestamp: message.createdAt,
      },
      updatedAt: new Date(),
    });

    const populated = await message.populate(
      'sender',
      'username displayName avatar',
    );

    return populated;
  }

  /**
   * Edit a message (only by sender)
   */
  async editMessage(
    messageId: string,
    userId: string,
    newContent: string,
  ): Promise<IMessage> {
    const message = await Message.findById(messageId);

    if (!message) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Message not found');
    }

    if (message.sender.toString() !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Can only edit your own messages');
    }

    if (message.deletedAt) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Cannot edit a deleted message');
    }

    message.content = newContent;
    message.editedAt = new Date();
    await message.save();

    const populated = await message.populate(
      'sender',
      'username displayName avatar',
    );

    return populated;
  }

  /**
   * Soft-delete a message (only by sender)
   */
  async deleteMessage(messageId: string, userId: string): Promise<IMessage> {
    const message = await Message.findById(messageId);

    if (!message) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Message not found');
    }

    if (message.sender.toString() !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Can only delete your own messages');
    }

    message.deletedAt = new Date();
    message.content = 'This message was deleted';
    await message.save();

    return message;
  }

  /**
   * Mark all messages in a conversation as read by a user
   */
  async markAsRead(conversationId: string, userId: string): Promise<void> {
    // Verify access
    await this.getConversation(conversationId, userId);

    await Message.updateMany(
      {
        conversationId: new mongoose.Types.ObjectId(conversationId),
        sender: { $ne: new mongoose.Types.ObjectId(userId) },
        'readBy.userId': { $ne: new mongoose.Types.ObjectId(userId) },
      },
      {
        $push: {
          readBy: { userId: new mongoose.Types.ObjectId(userId), readAt: new Date() },
        },
        $set: { status: 'read' },
      },
    );
  }
}

export const chatService = new ChatService();
