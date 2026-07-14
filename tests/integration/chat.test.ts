import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import { User } from '../../src/models/user.model';
import { Conversation } from '../../src/models/conversation.model';
import { Message } from '../../src/models/message.model';

jest.mock('../../src/config/index', () => ({
  config: {
    PORT: 3002,
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://localhost:27017/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    CORS_ORIGIN: '*',
    LOG_LEVEL: 'error',
  },
}));

jest.mock('../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  stream: { write: jest.fn() },
}));

jest.mock('../../src/middlewares/metrics.middleware', () => ({
  metricsMiddleware: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  metricsHandler: (_req: express.Request, res: express.Response) => res.end(''),
  messagesSentTotal: { inc: jest.fn() },
  setActiveUsers: jest.fn(),
}));

jest.mock('../../src/sockets/index', () => ({
  activeSocketConnections: 0,
}));

let mongoServer: MongoMemoryServer;
let app: express.Application;
let user1Token: string;
let user2Token: string;
let user2Id: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const appModule = await import('../../src/app');
  app = appModule.default;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});

  // Register two users
  const res1 = await request(app)
    .post('/api/auth/register')
    .send({ username: 'user1', email: 'user1@test.com', password: 'password123' });

  const res2 = await request(app)
    .post('/api/auth/register')
    .send({ username: 'user2', email: 'user2@test.com', password: 'password123' });

  user1Token = res1.body.data.tokens.accessToken;
  user2Token = res2.body.data.tokens.accessToken;
  user2Id = res2.body.data.user._id;
});

describe('Chat API Integration Tests', () => {
  describe('POST /api/chats', () => {
    it('should create a conversation', async () => {
      const res = await request(app)
        .post('/api/chats')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ participantId: user2Id })
        .expect(201);

      expect(res.body.data.type).toBe('direct');
      expect(res.body.data.participants).toHaveLength(2);
    });
  });

  describe('GET /api/chats', () => {
    it('should list user conversations', async () => {
      // Create a conversation first
      await request(app)
        .post('/api/chats')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ participantId: user2Id });

      const res = await request(app)
        .get('/api/chats')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/chats/:id/messages', () => {
    it('should send a message', async () => {
      const chatRes = await request(app)
        .post('/api/chats')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ participantId: user2Id });

      const chatId = chatRes.body.data._id;

      const res = await request(app)
        .post(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: 'Hello!' })
        .expect(201);

      expect(res.body.data.content).toBe('Hello!');
    });
  });

  describe('GET /api/chats/:id/messages', () => {
    it('should get messages with pagination', async () => {
      const chatRes = await request(app)
        .post('/api/chats')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ participantId: user2Id });

      const chatId = chatRes.body.data._id;

      // Send messages
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post(`/api/chats/${chatId}/messages`)
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ content: `Message ${i}` });
      }

      const res = await request(app)
        .get(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(res.body.data.messages).toHaveLength(3);
    });
  });

  describe('POST /api/chats/:id/read', () => {
    it('should mark messages as read', async () => {
      const chatRes = await request(app)
        .post('/api/chats')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ participantId: user2Id });

      const chatId = chatRes.body.data._id;

      await request(app)
        .post(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: 'Read me!' });

      await request(app)
        .post(`/api/chats/${chatId}/read`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);
    });
  });
});
