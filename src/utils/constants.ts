// Pagination
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

// Redis Key Prefixes
export const REDIS_KEYS = {
  ONLINE_USERS: 'online_users',
  USER_SOCKET: 'user_socket:',
  SOCKET_USER: 'socket_user:',
  USER_SESSION: 'user_session:',
  CACHE_USER: 'cache:user:',
  CACHE_CONVERSATION: 'cache:conversation:',
  TYPING: 'typing:',
} as const;

// Redis TTLs (seconds)
export const REDIS_TTL = {
  USER_SESSION: 86400, // 24 hours
  USER_CACHE: 3600, // 1 hour
  CONVERSATION_CACHE: 1800, // 30 minutes
  TYPING: 5, // 5 seconds
} as const;

// Message types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
  SYSTEM: 'system',
} as const;

// Message status
export const MESSAGE_STATUS = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
} as const;

// Conversation types
export const CONVERSATION_TYPES = {
  DIRECT: 'direct',
  GROUP: 'group',
} as const;

// User status
export const USER_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  AWAY: 'away',
} as const;

// Group roles
export const GROUP_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;
