import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import { Group, IGroup } from '../models/group.model.js';
import { Conversation } from '../models/conversation.model.js';
import { Message } from '../models/message.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';

export class GroupService {
  /**
   * Create a new group with a backing conversation
   */
  async createGroup(
    adminId: string,
    name: string,
    memberIds: string[],
    description?: string,
  ): Promise<IGroup> {
    // Verify all members exist
    const allMemberIds = [...new Set([adminId, ...memberIds])];
    const existingUsers = await User.find({
      _id: { $in: allMemberIds.map((id) => new mongoose.Types.ObjectId(id)) },
    });

    if (existingUsers.length !== allMemberIds.length) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'One or more members not found');
    }

    // Create the backing conversation
    const conversation = await Conversation.create({
      type: 'group',
      participants: allMemberIds,
    });

    // Create the group
    const members = allMemberIds.map((id) => ({
      userId: new mongoose.Types.ObjectId(id),
      role: id === adminId ? ('admin' as const) : ('member' as const),
      joinedAt: new Date(),
    }));

    const group = await Group.create({
      name,
      description: description || '',
      conversationId: conversation._id,
      admin: adminId,
      members,
    });

    // Send system message
    await Message.create({
      conversationId: conversation._id,
      sender: adminId,
      content: `Group "${name}" was created`,
      type: 'system',
    });

    logger.info(`Group created: ${name} by ${adminId}`);

    const populated = await group.populate([
      { path: 'admin', select: 'username displayName avatar' },
      { path: 'members.userId', select: 'username displayName avatar' },
    ]);

    return populated;
  }

  /**
   * Get group by ID with populated members
   */
  async getGroup(groupId: string): Promise<IGroup> {
    const group = await Group.findById(groupId).populate([
      { path: 'admin', select: 'username displayName avatar' },
      { path: 'members.userId', select: 'username displayName avatar status lastSeen' },
    ]);

    if (!group) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Group not found');
    }

    return group;
  }

  /**
   * Update group details (admin only)
   */
  async updateGroup(
    groupId: string,
    userId: string,
    data: { name?: string; description?: string; avatar?: string },
  ): Promise<IGroup> {
    const group = await Group.findById(groupId);

    if (!group) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Group not found');
    }

    if (group.admin.toString() !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Only the admin can update the group');
    }

    Object.assign(group, data);
    await group.save();

    // System message
    if (data.name) {
      await Message.create({
        conversationId: group.conversationId,
        sender: userId,
        content: `Group name changed to "${data.name}"`,
        type: 'system',
      });
    }

    const populated = await group.populate([
      { path: 'admin', select: 'username displayName avatar' },
      { path: 'members.userId', select: 'username displayName avatar' },
    ]);

    return populated;
  }

  /**
   * Delete a group (admin only)
   */
  async deleteGroup(groupId: string, userId: string): Promise<void> {
    const group = await Group.findById(groupId);

    if (!group) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Group not found');
    }

    if (group.admin.toString() !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Only the admin can delete the group');
    }

    // Delete all messages in the conversation
    await Message.deleteMany({ conversationId: group.conversationId });
    // Delete the conversation
    await Conversation.findByIdAndDelete(group.conversationId);
    // Delete the group
    await Group.findByIdAndDelete(groupId);

    logger.info(`Group deleted: ${groupId} by ${userId}`);
  }

  /**
   * Add members to a group (admin only)
   */
  async addMembers(
    groupId: string,
    userId: string,
    memberIds: string[],
  ): Promise<IGroup> {
    const group = await Group.findById(groupId);

    if (!group) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Group not found');
    }

    if (group.admin.toString() !== userId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Only the admin can add members');
    }

    // Filter out existing members
    const existingMemberIds = group.members.map((m) => m.userId.toString());
    const newMemberIds = memberIds.filter((id) => !existingMemberIds.includes(id));

    if (newMemberIds.length === 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'All specified users are already members');
    }

    // Verify new members exist
    const newUsers = await User.find({
      _id: { $in: newMemberIds.map((id) => new mongoose.Types.ObjectId(id)) },
    });

    if (newUsers.length !== newMemberIds.length) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'One or more users not found');
    }

    // Add to group members
    const newMembers = newMemberIds.map((id) => ({
      userId: new mongoose.Types.ObjectId(id),
      role: 'member' as const,
      joinedAt: new Date(),
    }));

    group.members.push(...newMembers);
    await group.save();

    // Add to conversation participants
    await Conversation.findByIdAndUpdate(group.conversationId, {
      $addToSet: {
        participants: {
          $each: newMemberIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
      },
    });

    // System message
    const usernames = newUsers.map((u) => u.displayName || u.username).join(', ');
    await Message.create({
      conversationId: group.conversationId,
      sender: userId,
      content: `${usernames} joined the group`,
      type: 'system',
    });

    const populated = await group.populate([
      { path: 'admin', select: 'username displayName avatar' },
      { path: 'members.userId', select: 'username displayName avatar' },
    ]);

    return populated;
  }

  /**
   * Remove a member from a group (admin only)
   */
  async removeMember(
    groupId: string,
    adminId: string,
    memberId: string,
  ): Promise<IGroup> {
    const group = await Group.findById(groupId);

    if (!group) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Group not found');
    }

    if (group.admin.toString() !== adminId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Only the admin can remove members');
    }

    if (adminId === memberId) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Admin cannot remove themselves. Use leave group instead.',
      );
    }

    const memberIndex = group.members.findIndex(
      (m) => m.userId.toString() === memberId,
    );

    if (memberIndex === -1) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Member not found in group');
    }

    group.members.splice(memberIndex, 1);
    await group.save();

    // Remove from conversation
    await Conversation.findByIdAndUpdate(group.conversationId, {
      $pull: { participants: new mongoose.Types.ObjectId(memberId) },
    });

    // System message
    const removedUser = await User.findById(memberId);
    await Message.create({
      conversationId: group.conversationId,
      sender: adminId,
      content: `${removedUser?.displayName || removedUser?.username} was removed from the group`,
      type: 'system',
    });

    const populated = await group.populate([
      { path: 'admin', select: 'username displayName avatar' },
      { path: 'members.userId', select: 'username displayName avatar' },
    ]);

    return populated;
  }

  /**
   * Leave a group. If admin leaves, transfer admin to next member or delete group.
   */
  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const group = await Group.findById(groupId);

    if (!group) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Group not found');
    }

    const memberIndex = group.members.findIndex(
      (m) => m.userId.toString() === userId,
    );

    if (memberIndex === -1) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'You are not a member of this group');
    }

    // If admin is leaving
    if (group.admin.toString() === userId) {
      const remainingMembers = group.members.filter(
        (m) => m.userId.toString() !== userId,
      );

      if (remainingMembers.length === 0) {
        // No members left — delete the group
        await this.deleteGroup(groupId, userId);
        return;
      }

      // Transfer admin to the next member
      group.admin = remainingMembers[0].userId;
      remainingMembers[0].role = 'admin';
    }

    // Remove the user
    group.members.splice(memberIndex, 1);
    await group.save();

    // Remove from conversation
    await Conversation.findByIdAndUpdate(group.conversationId, {
      $pull: { participants: new mongoose.Types.ObjectId(userId) },
    });

    // System message
    const leavingUser = await User.findById(userId);
    await Message.create({
      conversationId: group.conversationId,
      sender: userId,
      content: `${leavingUser?.displayName || leavingUser?.username} left the group`,
      type: 'system',
    });

    logger.info(`User ${userId} left group ${groupId}`);
  }
}

export const groupService = new GroupService();
