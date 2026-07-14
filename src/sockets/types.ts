import { IMessage } from '../models/message.model.js';

// Server → Client events
export interface ServerToClientEvents {
  'message:new': (message: IMessage) => void;
  'message:updated': (message: IMessage) => void;
  'message:deleted': (data: { messageId: string; conversationId: string }) => void;
  'message:delivered': (data: { messageId: string; conversationId: string }) => void;
  'message:read': (data: {
    conversationId: string;
    userId: string;
    readAt: string;
  }) => void;
  'user:online': (data: { userId: string }) => void;
  'user:offline': (data: { userId: string; lastSeen: string }) => void;
  'user:typing': (data: { conversationId: string; userId: string; username: string }) => void;
  'user:stop-typing': (data: { conversationId: string; userId: string }) => void;
  error: (data: { message: string }) => void;
}

// Client → Server events
export interface ClientToServerEvents {
  'message:send': (
    data: { conversationId: string; content: string; type?: string },
    ack: (response: { success: boolean; message?: IMessage; error?: string }) => void,
  ) => void;
  'message:edit': (
    data: { messageId: string; content: string },
    ack: (response: { success: boolean; message?: IMessage; error?: string }) => void,
  ) => void;
  'message:delete': (
    data: { messageId: string },
    ack: (response: { success: boolean; error?: string }) => void,
  ) => void;
  'message:read': (data: { conversationId: string }) => void;
  'typing:start': (data: { conversationId: string }) => void;
  'typing:stop': (data: { conversationId: string }) => void;
  'conversation:join': (data: { conversationId: string }) => void;
  'conversation:leave': (data: { conversationId: string }) => void;
}

// Inter-server events (for scaling with Redis adapter)
export interface InterServerEvents {
  ping: () => void;
}

// Socket data (attached to each socket)
export interface SocketData {
  userId: string;
  email: string;
  username: string;
}
