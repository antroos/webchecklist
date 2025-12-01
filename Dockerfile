# Use Node.js 20 with full system for Playwright
FROM node:20

# Install Python and system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install web dependencies
COPY web/package*.json ./web/
RUN cd web && npm ci

# Copy web source
COPY web/ ./web/

# Build Next.js app
RUN cd web && npm run build

# Setup Python service
COPY browser-service/ ./browser-service/
RUN cd browser-service && \
    python3 -m venv venv && \
    . venv/bin/activate && \
    pip install --no-cache-dir -r requirements.txt && \
    playwright install chromium && \
    playwright install-deps chromium

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Start Next.js
CMD ["sh", "-c", "cd web && npm start"]

