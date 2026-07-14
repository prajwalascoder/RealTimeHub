import mongoose, { Schema, Document } from 'mongoose';

export interface ILastMessage {
  content: string;
  sender: mongoose.Types.ObjectId;
  timestamp: Date;
}

export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId;
  type: 'direct' | 'group';
  participants: mongoose.Types.ObjectId[];
  lastMessage?: ILastMessage;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: ['direct', 'group'],
      required: true,
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      content: { type: String },
      sender: { type: Schema.Types.ObjectId, ref: 'User' },
      timestamp: { type: Date },
    },
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

// Compound index for finding conversations between specific participants
conversationSchema.index({ participants: 1 });
// Sort conversations by last activity
conversationSchema.index({ updatedAt: -1 });
// Find by type
conversationSchema.index({ type: 1 });

export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);
