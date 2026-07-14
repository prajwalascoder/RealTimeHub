import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { userService } from '../services/user.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const searchUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query.q as string | undefined;
  const page = req.query.page as string | undefined;
  const limit = req.query.limit as string | undefined;

  const result = await userService.searchUsers(
    q,
    Number(page) || 1,
    Number(limit) || 20,
  );

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, result, 'Users fetched successfully'));
});

export const getUserById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await userService.getUserById(req.params.id as string);

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, user, 'User fetched successfully'));
});
