import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../utils/ApiError.js';

export const validate = (schema: ZodType) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        next(
          new ApiError(
            StatusCodes.BAD_REQUEST,
            'Validation failed',
            errorMessages,
          ),
        );
      } else {
        next(error);
      }
    }
  };
};
