# ── Build Stage ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ── Production Stage ─────────────────────────────────────
FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy only compiled output from builder
COPY --from=builder /app/dist ./dist

# Switch to non-root user
USER appuser

EXPOSE 3000

# Use node directly instead of npm (avoids extra npm process)
CMD ["node", "dist/server.js"]
