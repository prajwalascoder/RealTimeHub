import { z } from 'zod';

export const createGroupSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, 'Group name must be at least 2 characters')
      .max(100, 'Group name must be at most 100 characters'),
    description: z.string().max(500).optional(),
    memberIds: z
      .array(z.string())
      .min(1, 'At least 1 member is required')
      .max(100, 'Maximum 100 members'),
  }),
});

export const updateGroupSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Group ID is required'),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
    avatar: z.string().url().optional(),
  }),
});

export const getGroupSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Group ID is required'),
  }),
});

export const addMembersSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Group ID is required'),
  }),
  body: z.object({
    memberIds: z
      .array(z.string())
      .min(1, 'At least 1 member is required'),
  }),
});

export const removeMemberSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Group ID is required'),
    memberId: z.string().min(1, 'Member ID is required'),
  }),
});

export const leaveGroupSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Group ID is required'),
  }),
});
