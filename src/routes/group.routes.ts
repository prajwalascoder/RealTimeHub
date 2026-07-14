import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createGroupSchema,
  updateGroupSchema,
  getGroupSchema,
  addMembersSchema,
  removeMemberSchema,
  leaveGroupSchema,
} from '../validators/group.validator.js';
import * as groupController from '../controllers/group.controller.js';

const router = Router();

/**
 * @openapi
 * /api/groups:
 *   post:
 *     tags: [Groups]
 *     summary: Create a new group
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, memberIds]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               memberIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Group created successfully
 */
router.post('/', authenticate, validate(createGroupSchema), groupController.createGroup);

/**
 * @openapi
 * /api/groups/{id}:
 *   get:
 *     tags: [Groups]
 *     summary: Get group details
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
 *         description: Group fetched successfully
 *       404:
 *         description: Group not found
 *   put:
 *     tags: [Groups]
 *     summary: Update group (admin only)
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: Group updated successfully
 *   delete:
 *     tags: [Groups]
 *     summary: Delete group (admin only)
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
 *         description: Group deleted successfully
 */
router.get('/:id', authenticate, validate(getGroupSchema), groupController.getGroup);
router.put('/:id', authenticate, validate(updateGroupSchema), groupController.updateGroup);
router.delete('/:id', authenticate, validate(getGroupSchema), groupController.deleteGroup);

/**
 * @openapi
 * /api/groups/{id}/members:
 *   post:
 *     tags: [Groups]
 *     summary: Add members to group (admin only)
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
 *             required: [memberIds]
 *             properties:
 *               memberIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Members added successfully
 */
router.post(
  '/:id/members',
  authenticate,
  validate(addMembersSchema),
  groupController.addMembers,
);

/**
 * @openapi
 * /api/groups/{id}/members/{memberId}:
 *   delete:
 *     tags: [Groups]
 *     summary: Remove a member from group (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member removed successfully
 */
router.delete(
  '/:id/members/:memberId',
  authenticate,
  validate(removeMemberSchema),
  groupController.removeMember,
);

/**
 * @openapi
 * /api/groups/{id}/leave:
 *   post:
 *     tags: [Groups]
 *     summary: Leave a group
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
 *         description: Left group successfully
 */
router.post(
  '/:id/leave',
  authenticate,
  validate(leaveGroupSchema),
  groupController.leaveGroup,
);

/**
 * @openapi
 * /api/groups/{id}/messages:
 *   get:
 *     tags: [Groups]
 *     summary: Get group messages (cursor-based pagination)
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
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Messages fetched successfully
 */
router.get('/:id/messages', authenticate, groupController.getGroupMessages);

export default router;
