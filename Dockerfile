# Multi-stage build for web UI + browser service

FROM node:20-slim AS web-builder

WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Final image with Node.js + Python + Playwright
FROM node:20-slim

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Node.js parts
COPY package*.json ./
RUN npm ci --production

# Copy built Next.js app
COPY --from=web-builder /app/web/.next ./web/.next
COPY --from=web-builder /app/web/public ./web/public
COPY web/package*.json ./web/
COPY web/next.config.ts ./web/
COPY web/postcss.config.mjs ./web/
COPY web/tsconfig.json ./web/

# Copy source code
COPY src/ ./src/

# Copy and setup Python service
COPY browser-service/ ./browser-service/
RUN cd browser-service && \
    python3 -m venv venv && \
    . venv/bin/activate && \
    pip install --no-cache-dir -r requirements.txt && \
    playwright install chromium && \
    playwright install-deps chromium

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Start Next.js web server
CMD ["sh", "-c", "cd web && npm start"]

