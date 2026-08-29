# ============================================================
# پت‌شاپ — Dockerfile
# ساخت تصویر: docker build -t petshop .
# ============================================================
FROM node:20-slim

# ابزارهای ساخت برای کامپایل native modules (better-sqlite3, sharp)
# اگر پری‌بیلد موجود باشد سریع‌تر می‌شود، ولی برای اطمینان در هر معماری
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# نصب وابستگی‌ها (بدون devDependencies → پاپیتر/کروم در تصویر نیست)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# کپی کد برنامه
COPY server ./server
COPY public ./public
COPY admin ./admin

# دایرکتوری‌های قابل نوشتن (دیتابیس و آپلودها — در Docker Compose روی Volume)
RUN mkdir -p data uploads && chown -R node:node /app

USER node

ENV PORT=3000
EXPOSE 3000

# بررسی سلامت (در دسترس بودن API عمومی)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD node -e "fetch('http://localhost:3000/api/settings/public').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
