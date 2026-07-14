import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { User } from '../../../src/models/user.model';
import { AuthService } from '../../../src/services/auth.service';

// Mock the JWT and config modules
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
let authService: AuthService;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  authService = new AuthService();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
});

describe('AuthService', () => {
  const validUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
    displayName: 'Test User',
  };

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const result = await authService.register(validUser);

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(validUser.email);
      expect(result.user.username).toBe(validUser.username);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should hash the password', async () => {
      const result = await authService.register(validUser);
      const userWithPassword = await User.findById(result.user._id).select('+password');
      expect(userWithPassword?.password).not.toBe(validUser.password);
    });

    it('should throw error for duplicate email', async () => {
      await authService.register(validUser);

      await expect(
        authService.register({
          ...validUser,
          username: 'different',
        }),
      ).rejects.toThrow('Email already registered');
    });

    it('should throw error for duplicate username', async () => {
      await authService.register(validUser);

      await expect(
        authService.register({
          ...validUser,
          email: 'different@example.com',
        }),
      ).rejects.toThrow('Username already taken');
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await authService.register(validUser);
    });

    it('should login successfully with correct credentials', async () => {
      const result = await authService.login({
        email: validUser.email,
        password: validUser.password,
      });

      expect(result.user).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should set user status to online', async () => {
      const result = await authService.login({
        email: validUser.email,
        password: validUser.password,
      });

      const user = await User.findById(result.user._id);
      expect(user?.status).toBe('online');
    });

    it('should throw error for wrong password', async () => {
      await expect(
        authService.login({
          email: validUser.email,
          password: 'wrongpassword',
        }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for non-existent email', async () => {
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: validUser.password,
        }),
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('should set user status to offline', async () => {
      const { user } = await authService.register(validUser);
      await authService.logout(user._id.toString());

      const updatedUser = await User.findById(user._id);
      expect(updatedUser?.status).toBe('offline');
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const { user } = await authService.register(validUser);
      const profile = await authService.getProfile(user._id.toString());

      expect(profile.email).toBe(validUser.email);
      expect(profile.username).toBe(validUser.username);
    });

    it('should throw error for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      await expect(authService.getProfile(fakeId)).rejects.toThrow('User not found');
    });
  });

  describe('updateProfile', () => {
    it('should update display name', async () => {
      const { user } = await authService.register(validUser);
      const updated = await authService.updateProfile(user._id.toString(), {
        displayName: 'New Name',
      });

      expect(updated.displayName).toBe('New Name');
    });
  });

  describe('refreshToken', () => {
    it('should return new token pair', async () => {
      const { tokens } = await authService.register(validUser);
      const newTokens = await authService.refreshToken(tokens.refreshToken);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.accessToken).not.toBe(tokens.accessToken);
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(authService.refreshToken('invalid-token')).rejects.toThrow(
        'Invalid refresh token',
      );
    });
  });
});
