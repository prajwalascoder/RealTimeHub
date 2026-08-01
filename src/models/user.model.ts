import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  password: string;
  displayName: string;
  avatar: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: Date;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

interface IUserModel extends Model<IUser> {
  findByEmail(email: string): Promise<IUser | null>;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username must be at most 30 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: [50, 'Display name must be at most 50 characters'],
    },
    avatar: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'away'],
      default: 'offline',
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    refreshToken: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.password = undefined;
        ret.refreshToken = undefined;
        ret.__v = undefined;
        return ret;
      },
    },
  },
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Set displayName to username if not provided
userSchema.pre('save', function () {
  if (!this.displayName) {
    this.displayName = this.username;
  }
});

// Instance method: compare password
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Static method: find by email
userSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email }).select('+password +refreshToken');
};

// Text index for search
userSchema.index({ username: 'text', displayName: 'text' });

export const User = mongoose.model<IUser, IUserModel>('User', userSchema);
