import { z } from 'zod';

export const createChatSchema = z.object({
  body: z.object({
    participantId: z.string().min(1, 'Participant ID is required'),
  }),
});

export const getChatSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Chat ID is required'),
  }),
});

export const getMessagesSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Chat ID is required'),
  }),
  query: z.object({
    cursor: z.string().optional(),
    limit: z.string().optional().default('50'),
  }),
});

export const sendMessageSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Chat ID is required'),
  }),
  body: z.object({
    content: z
      .string()
      .min(1, 'Message content is required')
      .max(5000, 'Message too long'),
    type: z.enum(['text', 'image', 'file']).optional().default('text'),
  }),
});

export const editMessageSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Chat ID is required'),
    messageId: z.string().min(1, 'Message ID is required'),
  }),
  body: z.object({
    content: z
      .string()
      .min(1, 'Message content is required')
      .max(5000, 'Message too long'),
  }),
});

export const deleteMessageSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Chat ID is required'),
    messageId: z.string().min(1, 'Message ID is required'),
  }),
});

export const markReadSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Chat ID is required'),
  }),
});
