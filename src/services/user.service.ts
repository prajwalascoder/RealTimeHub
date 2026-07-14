import { StatusCodes } from 'http-status-codes';
import { User, IUser } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { MAX_PAGE_SIZE } from '../utils/constants.js';

export class UserService {
  async searchUsers(
    query: string = '',
    page: number = 1,
    limit: number = 20,
  ): Promise<{ users: IUser[]; total: number; page: number; pages: number }> {
    const safeLimit = Math.min(limit, MAX_PAGE_SIZE);
    const skip = (page - 1) * safeLimit;

    const filter = query
      ? {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { displayName: { $regex: query, $options: 'i' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -refreshToken')
        .sort({ username: 1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return {
      users: users as IUser[],
      total,
      page,
      pages: Math.ceil(total / safeLimit),
    };
  }

  async getUserById(userId: string): Promise<IUser> {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    return user;
  }

  async updateOnlineStatus(
    userId: string,
    status: 'online' | 'offline' | 'away',
  ): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      status,
      ...(status === 'offline' ? { lastSeen: new Date() } : {}),
    });
  }
}

export const userService = new UserService();
