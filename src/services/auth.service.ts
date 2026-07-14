import { StatusCodes } from 'http-status-codes';
import { User, IUser } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt.js';
import { logger } from '../config/logger.js';

interface RegisterInput {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  user: IUser;
  tokens: AuthTokens;
}

export class AuthService {
  async register(data: RegisterInput): Promise<AuthResponse> {
    // Check existing user
    const existingUser = await User.findOne({
      $or: [{ email: data.email }, { username: data.username }],
    });

    if (existingUser) {
      if (existingUser.email === data.email) {
        throw new ApiError(StatusCodes.CONFLICT, 'Email already registered');
      }
      throw new ApiError(StatusCodes.CONFLICT, 'Username already taken');
    }

    // Create user
    const user = await User.create(data);

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
    });

    // Save refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    logger.info(`User registered: ${user.email}`);

    return { user, tokens };
  }

  async login(data: LoginInput): Promise<AuthResponse> {
    // Find user with password field
    const user = await User.findByEmail(data.email);

    if (!user) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
    }

    // Compare password
    const isMatch = await user.comparePassword(data.password);
    if (!isMatch) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
    }

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
    });

    // Update user
    user.refreshToken = tokens.refreshToken;
    user.status = 'online';
    user.lastSeen = new Date();
    await user.save();

    logger.info(`User logged in: ${user.email}`);

    return { user, tokens };
  }

  async logout(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      refreshToken: null,
      status: 'offline',
      lastSeen: new Date(),
    });

    logger.info(`User logged out: ${userId}`);
  }

  async refreshToken(token: string): Promise<AuthTokens> {
    try {
      const decoded = verifyRefreshToken(token);

      const user = await User.findById(decoded.userId).select('+refreshToken');

      if (!user || user.refreshToken !== token) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid refresh token');
      }

      // Generate new token pair
      const tokens = generateTokenPair({
        userId: user._id.toString(),
        email: user.email,
      });

      // Save new refresh token
      user.refreshToken = tokens.refreshToken;
      await user.save();

      return tokens;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid refresh token');
    }
  }

  async getProfile(userId: string): Promise<IUser> {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    data: { displayName?: string; avatar?: string },
  ): Promise<IUser> {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: data },
      { new: true, runValidators: true },
    );

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    logger.info(`User profile updated: ${userId}`);
    return user;
  }
}

export const authService = new AuthService();
