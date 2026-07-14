import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { User } from '../../../src/models/user.model';
import { Conversation } from '../../../src/models/conversation.model';
import { Message } from '../../../src/models/message.model';
import { ChatService } from '../../../src/services/chat.service';

jest.mock('../../../src/config/index', () => ({
  config: {
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    LOG_LEVEL: 'error',
    NODE_ENV: 'test',
  },
}));

jest.mock('../../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

let mongoServer: MongoMemoryServer;
let chatService: ChatService;
let user1Id: string;
let user2Id: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  chatService = new ChatService();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});

  // Create test users
  const user1 = await User.create({
    username: 'user1',
    email: 'user1@test.com',
    password: 'password123',
  });
  const user2 = await User.create({
    username: 'user2',
    email: 'user2@test.com',
    password: 'password123',
  });

  user1Id = user1._id.toString();
  user2Id = user2._id.toString();
});

describe('ChatService', () => {
  describe('createOrGetConversation', () => {
    it('should create a new conversation between two users', async () => {
      const conversation = await chatService.createOrGetConversation(user1Id, user2Id);

      expect(conversation).toBeDefined();
      expect(conversation.type).toBe('direct');
      expect(conversation.participants).toHaveLength(2);
    });

    it('should return existing conversation if one exists', async () => {
      const conv1 = await chatService.createOrGetConversation(user1Id, user2Id);
      const conv2 = await chatService.createOrGetConversation(user1Id, user2Id);

      expect(conv1._id.toString()).toBe(conv2._id.toString());
    });

    it('should throw error when creating conversation with self', async () => {
      await expect(
        chatService.createOrGetConversation(user1Id, user1Id),
      ).rejects.toThrow('Cannot create conversation with yourself');
    });

    it('should throw error for non-existent target user', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      await expect(
        chatService.createOrGetConversation(user1Id, fakeId),
      ).rejects.toThrow('Target user not found');
    });
  });

  describe('sendMessage', () => {
    let conversationId: string;

    beforeEach(async () => {
      const conversation = await chatService.createOrGetConversation(user1Id, user2Id);
      conversationId = conversation._id.toString();
    });

    it('should send a message successfully', async () => {
      const message = await chatService.sendMessage(
        conversationId,
        user1Id,
        'Hello!',
      );

      expect(message.content).toBe('Hello!');
      expect(message.sender._id.toString()).toBe(user1Id);
      expect(message.status).toBe('sent');
    });

    it('should update conversation lastMessage', async () => {
      await chatService.sendMessage(conversationId, user1Id, 'Hello!');

      const conversation = await Conversation.findById(conversationId);
      expect(conversation?.lastMessage?.content).toBe('Hello!');
    });
  });

  describe('getMessages', () => {
    let conversationId: string;

    beforeEach(async () => {
      const conversation = await chatService.createOrGetConversation(user1Id, user2Id);
      conversationId = conversation._id.toString();

      // Send some messages
      for (let i = 0; i < 5; i++) {
        await chatService.sendMessage(conversationId, user1Id, `Message ${i}`);
      }
    });

    it('should return messages with pagination', async () => {
      const result = await chatService.getMessages(conversationId, user1Id, undefined, 3);

      expect(result.messages).toHaveLength(3);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });

    it('should return all messages when limit is sufficient', async () => {
      const result = await chatService.getMessages(conversationId, user1Id, undefined, 10);

      expect(result.messages).toHaveLength(5);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('editMessage', () => {
    let conversationId: string;

    beforeEach(async () => {
      const conversation = await chatService.createOrGetConversation(user1Id, user2Id);
      conversationId = conversation._id.toString();
    });

    it('should edit own message', async () => {
      const message = await chatService.sendMessage(conversationId, user1Id, 'Original');
      const edited = await chatService.editMessage(
        message._id.toString(),
        user1Id,
        'Edited',
      );

      expect(edited.content).toBe('Edited');
      expect(edited.editedAt).toBeDefined();
    });

    it('should throw error when editing others message', async () => {
      const message = await chatService.sendMessage(conversationId, user1Id, 'Original');

      await expect(
        chatService.editMessage(message._id.toString(), user2Id, 'Edited'),
      ).rejects.toThrow('Can only edit your own messages');
    });
  });

  describe('deleteMessage', () => {
    let conversationId: string;

    beforeEach(async () => {
      const conversation = await chatService.createOrGetConversation(user1Id, user2Id);
      conversationId = conversation._id.toString();
    });

    it('should soft-delete own message', async () => {
      const message = await chatService.sendMessage(conversationId, user1Id, 'To delete');
      const deleted = await chatService.deleteMessage(message._id.toString(), user1Id);

      expect(deleted.deletedAt).toBeDefined();
      expect(deleted.content).toBe('This message was deleted');
    });
  });

  describe('markAsRead', () => {
    it('should mark messages as read', async () => {
      const conversation = await chatService.createOrGetConversation(user1Id, user2Id);
      const conversationId = conversation._id.toString();

      await chatService.sendMessage(conversationId, user1Id, 'Unread message');
      await chatService.markAsRead(conversationId, user2Id);

      const messages = await Message.find({ conversationId });
      expect(messages[0].readBy).toHaveLength(1);
      expect(messages[0].readBy[0].userId.toString()).toBe(user2Id);
    });
  });
});
