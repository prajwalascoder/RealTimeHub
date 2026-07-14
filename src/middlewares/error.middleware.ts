import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';
import { config } from '../config/index.js';
import mongoose from 'mongoose';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let error = err;

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    error = new ApiError(StatusCodes.BAD_REQUEST, 'Validation error', messages);
  }

  // Mongoose cast error (invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    error = new ApiError(
      StatusCodes.BAD_REQUEST,
      `Invalid ${err.path}: ${err.value}`,
    );
  }

  // Mongoose duplicate key error
  if (err.name === 'MongoServerError' && (err as unknown as { code: number }).code === 11000) {
    const field = Object.keys(
      (err as unknown as { keyValue: Record<string, unknown> }).keyValue,
    )[0];
    error = new ApiError(
      StatusCodes.CONFLICT,
      `${field} already exists`,
    );
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    error = new ApiError(StatusCodes.UNAUTHORIZED, 'Token expired');
  }

  // Handle ApiError
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      statusCode: error.statusCode,
      message: error.message,
      errors: error.errors,
      ...(config.NODE_ENV === 'development' && { stack: error.stack }),
    });
    return;
  }

  // Unhandled errors
  logger.error('Unhandled error:', err);
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
    ...(config.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
