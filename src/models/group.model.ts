import mongoose, { Schema, Document } from 'mongoose';

export interface IGroupMember {
  userId: mongoose.Types.ObjectId;
  role: 'admin' | 'member';
  joinedAt: Date;
}

export interface IGroup extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  avatar: string;
  conversationId: mongoose.Types.ObjectId;
  admin: mongoose.Types.ObjectId;
  members: IGroupMember[];
  createdAt: Date;
  updatedAt: Date;
}

const groupSchema = new Schema<IGroup>(
  {
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      minlength: [2, 'Group name must be at least 2 characters'],
      maxlength: [100, 'Group name must be at most 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Group description must be at most 500 characters'],
      default: '',
    },
    avatar: {
      type: String,
      default: '',
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      unique: true,
    },
    admin: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: ['admin', 'member'],
          default: 'member',
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.__v = undefined;
        return ret;
      },
    },
  },
);

// Find groups by member
groupSchema.index({ 'members.userId': 1 });
// Find group by conversation
groupSchema.index({ conversationId: 1 });
// Find groups by admin
groupSchema.index({ admin: 1 });

export const Group = mongoose.model<IGroup>('Group', groupSchema);
