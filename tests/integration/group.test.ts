import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import { User } from '../../src/models/user.model';
import { Group } from '../../src/models/group.model';
import { Conversation } from '../../src/models/conversation.model';
import { Message } from '../../src/models/message.model';

jest.mock('../../src/config/index', () => ({
  config: {
    PORT: 3003,
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
let adminToken: string;
let member1Token: string;
let member1Id: string;
let member2Id: string;

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
  await Group.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});

  const adminRes = await request(app)
    .post('/api/auth/register')
    .send({ username: 'admin', email: 'admin@test.com', password: 'password123' });

  const member1Res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'member1', email: 'member1@test.com', password: 'password123' });

  const member2Res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'member2', email: 'member2@test.com', password: 'password123' });

  adminToken = adminRes.body.data.tokens.accessToken;
  member1Token = member1Res.body.data.tokens.accessToken;
  member1Id = member1Res.body.data.user._id;
  member2Id = member2Res.body.data.user._id;
});

describe('Group API Integration Tests', () => {
  describe('POST /api/groups', () => {
    it('should create a group', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Group',
          description: 'A test group',
          memberIds: [member1Id, member2Id],
        })
        .expect(201);

      expect(res.body.data.name).toBe('Test Group');
      expect(res.body.data.members).toHaveLength(3);
    });
  });

  describe('GET /api/groups/:id', () => {
    it('should get group details', async () => {
      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Group', memberIds: [member1Id] });

      const groupId = createRes.body.data._id;

      const res = await request(app)
        .get(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.name).toBe('Test Group');
    });
  });

  describe('PUT /api/groups/:id', () => {
    it('should update group name', async () => {
      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Old Name', memberIds: [member1Id] });

      const groupId = createRes.body.data._id;

      const res = await request(app)
        .put(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Name' })
        .expect(200);

      expect(res.body.data.name).toBe('New Name');
    });

    it('should reject non-admin updates', async () => {
      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test', memberIds: [member1Id] });

      const groupId = createRes.body.data._id;

      await request(app)
        .put(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${member1Token}`)
        .send({ name: 'Hacked' })
        .expect(403);
    });
  });

  describe('POST /api/groups/:id/members', () => {
    it('should add members', async () => {
      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test', memberIds: [member1Id] });

      const groupId = createRes.body.data._id;

      const res = await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ memberIds: [member2Id] })
        .expect(200);

      expect(res.body.data.members).toHaveLength(3);
    });
  });

  describe('DELETE /api/groups/:id/members/:memberId', () => {
    it('should remove a member', async () => {
      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test', memberIds: [member1Id, member2Id] });

      const groupId = createRes.body.data._id;

      const res = await request(app)
        .delete(`/api/groups/${groupId}/members/${member1Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.members).toHaveLength(2);
    });
  });

  describe('POST /api/groups/:id/leave', () => {
    it('should allow member to leave', async () => {
      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test', memberIds: [member1Id] });

      const groupId = createRes.body.data._id;

      await request(app)
        .post(`/api/groups/${groupId}/leave`)
        .set('Authorization', `Bearer ${member1Token}`)
        .expect(200);
    });
  });

  describe('DELETE /api/groups/:id', () => {
    it('should delete group', async () => {
      const createRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test', memberIds: [member1Id] });

      const groupId = createRes.body.data._id;

      await request(app)
        .delete(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify deleted
      await request(app)
        .get(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
