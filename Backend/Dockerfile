# Multi-stage build for production optimization
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Install security updates
RUN apk upgrade --no-cache

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S vibesheets -u 1001

# Set working directory
WORKDIR /app

# Copy dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY --chown=vibesheets:nodejs package*.json ./
COPY --chown=vibesheets:nodejs production-server.js ./
COPY --chown=vibesheets:nodejs Frontend/ ./Frontend/

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=UTC

# Create necessary directories with correct permissions
RUN mkdir -p /app/logs && chown vibesheets:nodejs /app/logs

# Switch to non-root user
USER vibesheets

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "http.get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the application
CMD ["node", "production-server.js"]