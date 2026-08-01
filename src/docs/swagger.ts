import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '../config/index.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RealtimeHub API',
      version: '1.0.0',
      description:
        'Production-ready real-time messaging platform API supporting 1:1 and group messaging with Socket.IO, MongoDB, and Redis.',
      contact: {
        name: 'RealtimeHub',
      },
    },
    servers:
      config.NODE_ENV === 'production'
        ? [
            {
              url: '/',
              description: 'Production server',
            },
          ]
        : [
            {
              url: `http://localhost:${config.PORT}`,
              description: 'Development server',
            },
          ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User management endpoints' },
      { name: 'Chats', description: 'Chat/conversation endpoints' },
      { name: 'Groups', description: 'Group management endpoints' },
    ],
  },
  apis: ['./dist/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
