import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import { User } from '../../src/models/user.model';

// Mock config and logger before importing app modules
jest.mock('../../src/config/index', () => ({
  config: {
    PORT: 3001,
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

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Import app after mocks are set up
  const appModule = await import('../../src/app');
  app = appModule.default;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
});

describe('Auth API Integration Tests', () => {
  const validUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(validUser)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(validUser.email);
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });

    it('should return 400 for invalid data', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'invalid' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should return 409 for duplicate email', async () => {
      await request(app).post('/api/auth/register').send(validUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validUser, username: 'different' })
        .expect(409);

      expect(res.body.message).toContain('Email already registered');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(validUser);
    });

    it('should login successfully', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: validUser.email,
          password: validUser.password,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });

    it('should return 401 for wrong password', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: validUser.email,
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return profile for authenticated user', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send(validUser);

      const token = registerRes.body.data.tokens.accessToken;

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.email).toBe(validUser.email);
    });

    it('should return 401 without token', async () => {
      await request(app).get('/api/auth/profile').expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send(validUser);

      const refreshToken = registerRes.body.data.tokens.refreshToken;

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send(validUser);

      const token = registerRes.body.data.tokens.accessToken;

      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
