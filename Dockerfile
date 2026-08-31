# ============================================================
# پت‌شاپ — Dockerfile (Production-Ready)
# Multi-stage build, non-root user, proper caching
# ============================================================

# Stage 1: Build
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Stage 2: Production
FROM node:20-slim

# Security: نصب فقط ابزارهای لازم
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# کپی node_modules از مرحله build
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# کپی کد برنامه
COPY server ./server
COPY public ./public
COPY admin ./admin
COPY scripts ./scripts

# ایجاد دایرکتوری‌های لازم
RUN mkdir -p data uploads backups \
    && chmod +x scripts/*.sh

# Security: non-root user
RUN chown -R node:node /app
USER node

# Environment
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>r.json()).then(d=>process.exit(d.status==='healthy'?0:1)).catch(()=>process.exit(1))"

# Graceful shutdown
STOPSIGNAL SIGTERM

CMD ["node", "server/index.js"]
