import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { groupService } from '../services/group.service.js';
import { chatService } from '../services/chat.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createGroup = asyncHandler(async (req: AuthRequest, res: Response) => {
  const group = await groupService.createGroup(
    req.user!.userId,
    req.body.name,
    req.body.memberIds,
    req.body.description,
  );

  res
    .status(StatusCodes.CREATED)
    .json(new ApiResponse(StatusCodes.CREATED, group, 'Group created successfully'));
});

export const getGroup = asyncHandler(async (req: AuthRequest, res: Response) => {
  const group = await groupService.getGroup(req.params.id as string);

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, group, 'Group fetched successfully'));
});

export const updateGroup = asyncHandler(async (req: AuthRequest, res: Response) => {
  const group = await groupService.updateGroup(
    req.params.id as string,
    req.user!.userId,
    req.body,
  );

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, group, 'Group updated successfully'));
});

export const deleteGroup = asyncHandler(async (req: AuthRequest, res: Response) => {
  await groupService.deleteGroup(req.params.id as string, req.user!.userId);

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, null, 'Group deleted successfully'));
});

export const addMembers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const group = await groupService.addMembers(
    req.params.id as string,
    req.user!.userId,
    req.body.memberIds,
  );

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, group, 'Members added successfully'));
});

export const removeMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const group = await groupService.removeMember(
    req.params.id as string,
    req.user!.userId,
    req.params.memberId as string,
  );

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, group, 'Member removed successfully'));
});

export const leaveGroup = asyncHandler(async (req: AuthRequest, res: Response) => {
  await groupService.leaveGroup(req.params.id as string, req.user!.userId);

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, null, 'Left group successfully'));
});

export const getGroupMessages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const group = await groupService.getGroup(req.params.id as string);
  const cursor = req.query.cursor as string | undefined;
  const limit = req.query.limit as string | undefined;

  const result = await chatService.getMessages(
    group.conversationId.toString(),
    req.user!.userId,
    cursor,
    Number(limit) || 50,
  );

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, result, 'Group messages fetched successfully'));
});
