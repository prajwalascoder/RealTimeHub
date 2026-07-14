import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { User } from '../../../src/models/user.model';
import { Group } from '../../../src/models/group.model';
import { Conversation } from '../../../src/models/conversation.model';
import { Message } from '../../../src/models/message.model';
import { GroupService } from '../../../src/services/group.service';

jest.mock('../../../src/config/index', () => ({
  config: {
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    LOG_LEVEL: 'error',
    NODE_ENV: 'test',
  },
}));

jest.mock('../../../src/config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

let mongoServer: MongoMemoryServer;
let groupService: GroupService;
let adminId: string;
let member1Id: string;
let member2Id: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  groupService = new GroupService();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Group.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});

  const admin = await User.create({
    username: 'admin',
    email: 'admin@test.com',
    password: 'password123',
  });
  const member1 = await User.create({
    username: 'member1',
    email: 'member1@test.com',
    password: 'password123',
  });
  const member2 = await User.create({
    username: 'member2',
    email: 'member2@test.com',
    password: 'password123',
  });

  adminId = admin._id.toString();
  member1Id = member1._id.toString();
  member2Id = member2._id.toString();
});

describe('GroupService', () => {
  describe('createGroup', () => {
    it('should create a group successfully', async () => {
      const group = await groupService.createGroup(
        adminId,
        'Test Group',
        [member1Id, member2Id],
        'A test group',
      );

      expect(group.name).toBe('Test Group');
      expect(group.description).toBe('A test group');
      expect(group.members).toHaveLength(3); // admin + 2 members
      expect(group.admin._id.toString()).toBe(adminId);
    });

    it('should create a backing conversation', async () => {
      const group = await groupService.createGroup(adminId, 'Test Group', [member1Id]);
      const conversation = await Conversation.findById(group.conversationId);

      expect(conversation).toBeDefined();
      expect(conversation?.type).toBe('group');
      expect(conversation?.participants).toHaveLength(2);
    });

    it('should create a system message', async () => {
      const group = await groupService.createGroup(adminId, 'Test Group', [member1Id]);
      const messages = await Message.find({ conversationId: group.conversationId });

      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('system');
    });
  });

  describe('updateGroup', () => {
    it('should update group name', async () => {
      const group = await groupService.createGroup(adminId, 'Old Name', [member1Id]);
      const updated = await groupService.updateGroup(
        group._id.toString(),
        adminId,
        { name: 'New Name' },
      );

      expect(updated.name).toBe('New Name');
    });

    it('should reject non-admin updates', async () => {
      const group = await groupService.createGroup(adminId, 'Test', [member1Id]);

      await expect(
        groupService.updateGroup(group._id.toString(), member1Id, { name: 'New' }),
      ).rejects.toThrow('Only the admin can update the group');
    });
  });

  describe('addMembers', () => {
    it('should add new members', async () => {
      const group = await groupService.createGroup(adminId, 'Test', [member1Id]);
      const updated = await groupService.addMembers(
        group._id.toString(),
        adminId,
        [member2Id],
      );

      expect(updated.members).toHaveLength(3);
    });

    it('should reject adding existing members', async () => {
      const group = await groupService.createGroup(adminId, 'Test', [member1Id]);

      await expect(
        groupService.addMembers(group._id.toString(), adminId, [member1Id]),
      ).rejects.toThrow('All specified users are already members');
    });
  });

  describe('removeMember', () => {
    it('should remove a member', async () => {
      const group = await groupService.createGroup(adminId, 'Test', [member1Id, member2Id]);
      const updated = await groupService.removeMember(
        group._id.toString(),
        adminId,
        member1Id,
      );

      expect(updated.members).toHaveLength(2); // admin + member2
    });

    it('should prevent admin from removing themselves', async () => {
      const group = await groupService.createGroup(adminId, 'Test', [member1Id]);

      await expect(
        groupService.removeMember(group._id.toString(), adminId, adminId),
      ).rejects.toThrow('Admin cannot remove themselves');
    });
  });

  describe('leaveGroup', () => {
    it('should allow member to leave', async () => {
      const group = await groupService.createGroup(adminId, 'Test', [member1Id, member2Id]);
      await groupService.leaveGroup(group._id.toString(), member1Id);

      const updatedGroup = await Group.findById(group._id);
      expect(updatedGroup?.members).toHaveLength(2);
    });

    it('should transfer admin when admin leaves', async () => {
      const group = await groupService.createGroup(adminId, 'Test', [member1Id, member2Id]);
      await groupService.leaveGroup(group._id.toString(), adminId);

      const updatedGroup = await Group.findById(group._id);
      expect(updatedGroup?.admin.toString()).not.toBe(adminId);
    });

    it('should delete group when last member leaves', async () => {
      const group = await groupService.createGroup(adminId, 'Test', []);
      // Admin is the only member
      await groupService.leaveGroup(group._id.toString(), adminId);

      const deletedGroup = await Group.findById(group._id);
      expect(deletedGroup).toBeNull();
    });
  });

  describe('deleteGroup', () => {
    it('should delete group and all associated data', async () => {
      const group = await groupService.createGroup(adminId, 'Test', [member1Id]);
      await groupService.deleteGroup(group._id.toString(), adminId);

      const deletedGroup = await Group.findById(group._id);
      const deletedConversation = await Conversation.findById(group.conversationId);
      const messages = await Message.find({ conversationId: group.conversationId });

      expect(deletedGroup).toBeNull();
      expect(deletedConversation).toBeNull();
      expect(messages.length).toBe(0);
    });

    it('should reject non-admin deletion', async () => {
      const group = await groupService.createGroup(adminId, 'Test', [member1Id]);

      await expect(
        groupService.deleteGroup(group._id.toString(), member1Id),
      ).rejects.toThrow('Only the admin can delete the group');
    });
  });
});
