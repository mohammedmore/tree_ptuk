# Stage 1: Build Frontend Assets
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Runtime with Chromium dependencies for Edugate Scraper
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Install required shared libraries for headless Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npx playwright install chromium

# Copy server code and pre-compiled frontend bundle
COPY server/ ./server/
COPY Server.js ./
COPY scripts/ ./scripts/
COPY --from=builder /app/dist ./dist

# Create dedicated non-root execution user for security hardening and persist data directory
RUN groupadd -r ptuk && useradd -r -g ptuk -G audio,video ptuk \
    && mkdir -p /home/ptuk /app/data && chown -R ptuk:ptuk /home/ptuk /app
USER ptuk

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health/live || exit 1

CMD ["node", "Server.js"]
