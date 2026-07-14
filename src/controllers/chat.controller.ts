import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { chatService } from '../services/chat.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createChat = asyncHandler(async (req: AuthRequest, res: Response) => {
  const conversation = await chatService.createOrGetConversation(
    req.user!.userId,
    req.body.participantId,
  );

  res
    .status(StatusCodes.CREATED)
    .json(new ApiResponse(StatusCodes.CREATED, conversation, 'Chat created successfully'));
});

export const getChats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const conversations = await chatService.getUserConversations(req.user!.userId);

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, conversations, 'Chats fetched successfully'));
});

export const getChat = asyncHandler(async (req: AuthRequest, res: Response) => {
  const conversation = await chatService.getConversation(
    req.params.id as string,
    req.user!.userId,
  );

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, conversation, 'Chat fetched successfully'));
});

export const getMessages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const cursor = req.query.cursor as string | undefined;
  const limit = req.query.limit as string | undefined;

  const result = await chatService.getMessages(
    req.params.id as string,
    req.user!.userId,
    cursor,
    Number(limit) || 50,
  );

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, result, 'Messages fetched successfully'));
});

export const sendMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const message = await chatService.sendMessage(
    req.params.id as string,
    req.user!.userId,
    req.body.content,
    req.body.type,
  );

  res
    .status(StatusCodes.CREATED)
    .json(new ApiResponse(StatusCodes.CREATED, message, 'Message sent successfully'));
});

export const editMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const message = await chatService.editMessage(
    req.params.messageId as string,
    req.user!.userId,
    req.body.content,
  );

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, message, 'Message updated successfully'));
});

export const deleteMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const message = await chatService.deleteMessage(
    req.params.messageId as string,
    req.user!.userId,
  );

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, message, 'Message deleted successfully'));
});

export const markAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  await chatService.markAsRead(req.params.id as string, req.user!.userId);

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, null, 'Messages marked as read'));
});
