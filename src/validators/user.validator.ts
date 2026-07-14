import { z } from 'zod';

export const searchUsersSchema = z.object({
  query: z.object({
    q: z.string().optional(),
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('20'),
  }),
});

export const getUserByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
});
