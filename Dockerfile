# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install git for repository cloning
RUN apk add --no-cache git openssh-client

# Build arguments for traceability
ARG BUILD_ID
ARG BUILD_TIMESTAMP
ARG GIT_COMMIT
ARG GIT_BRANCH
ARG VERSION

# Labels for image identification
LABEL org.opencontainers.image.title="Nexus RepoSwarm Plugin" \
      org.opencontainers.image.description="AI-powered repository analysis and architecture discovery" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      com.adverant.build.id="${BUILD_ID}" \
      com.adverant.build.timestamp="${BUILD_TIMESTAMP}" \
      com.adverant.build.branch="${GIT_BRANCH}"

# Environment variables for runtime
ENV NODE_ENV=production \
    NEXUS_BUILD_ID="${BUILD_ID}" \
    NEXUS_BUILD_TIMESTAMP="${BUILD_TIMESTAMP}" \
    NEXUS_GIT_COMMIT="${GIT_COMMIT}" \
    NEXUS_VERSION="${VERSION}"

# Copy production dependencies
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy prompts (runtime resources)
COPY src/prompts ./dist/prompts

# Create non-root user
RUN addgroup -g 1001 -S nexus && \
    adduser -S nexus -u 1001 -G nexus && \
    mkdir -p /tmp/repos && \
    chown -R nexus:nexus /app /tmp/repos

USER nexus

# Expose port
EXPOSE 9200

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:9200/health || exit 1

# Start application
CMD ["node", "dist/index.js"]
