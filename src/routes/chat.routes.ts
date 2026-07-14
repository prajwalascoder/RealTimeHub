import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createChatSchema,
  getChatSchema,
  getMessagesSchema,
  sendMessageSchema,
  editMessageSchema,
  deleteMessageSchema,
  markReadSchema,
} from '../validators/chat.validator.js';
import * as chatController from '../controllers/chat.controller.js';

const router = Router();

/**
 * @openapi
 * /api/chats:
 *   post:
 *     tags: [Chats]
 *     summary: Create or get a 1:1 conversation
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [participantId]
 *             properties:
 *               participantId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Chat created/found successfully
 *   get:
 *     tags: [Chats]
 *     summary: Get all conversations for current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chats fetched successfully
 */
router.post('/', authenticate, validate(createChatSchema), chatController.createChat);
router.get('/', authenticate, chatController.getChats);

/**
 * @openapi
 * /api/chats/{id}:
 *   get:
 *     tags: [Chats]
 *     summary: Get a conversation by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat fetched successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Conversation not found
 */
router.get('/:id', authenticate, validate(getChatSchema), chatController.getChat);

/**
 * @openapi
 * /api/chats/{id}/messages:
 *   get:
 *     tags: [Chats]
 *     summary: Get messages in a conversation (cursor-based pagination)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: ISO date string cursor for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Messages fetched successfully
 *   post:
 *     tags: [Chats]
 *     summary: Send a message
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [text, image, file]
 *                 default: text
 *     responses:
 *       201:
 *         description: Message sent successfully
 */
router.get(
  '/:id/messages',
  authenticate,
  validate(getMessagesSchema),
  chatController.getMessages,
);
router.post(
  '/:id/messages',
  authenticate,
  validate(sendMessageSchema),
  chatController.sendMessage,
);

/**
 * @openapi
 * /api/chats/{id}/messages/{messageId}:
 *   put:
 *     tags: [Chats]
 *     summary: Edit a message
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message updated successfully
 *   delete:
 *     tags: [Chats]
 *     summary: Delete a message (soft delete)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message deleted successfully
 */
router.put(
  '/:id/messages/:messageId',
  authenticate,
  validate(editMessageSchema),
  chatController.editMessage,
);
router.delete(
  '/:id/messages/:messageId',
  authenticate,
  validate(deleteMessageSchema),
  chatController.deleteMessage,
);

/**
 * @openapi
 * /api/chats/{id}/read:
 *   post:
 *     tags: [Chats]
 *     summary: Mark all messages in conversation as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Messages marked as read
 */
router.post('/:id/read', authenticate, validate(markReadSchema), chatController.markAsRead);

export default router;
