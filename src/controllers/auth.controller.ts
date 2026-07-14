import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { authService } from '../services/auth.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await authService.register(req.body);

  res
    .status(StatusCodes.CREATED)
    .json(new ApiResponse(StatusCodes.CREATED, result, 'User registered successfully'));
});

export const login = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await authService.login(req.body);

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, result, 'Login successful'));
});

export const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
  await authService.logout(req.user!.userId);

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, null, 'Logout successful'));
});

export const refreshToken = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tokens = await authService.refreshToken(req.body.refreshToken);

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, tokens, 'Tokens refreshed successfully'));
});

export const getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await authService.getProfile(req.user!.userId);

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, user, 'Profile fetched successfully'));
});

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await authService.updateProfile(req.user!.userId, req.body);

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, user, 'Profile updated successfully'));
});
