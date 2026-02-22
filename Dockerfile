# ═══════════════════════════════════════════════════════════════════
# TradeForge OS v11.0 — Production Dockerfile
# Multi-stage build: install → build → serve
# Final image: ~180MB (Node.js slim + built assets)
# ═══════════════════════════════════════════════════════════════════

# ─── Stage 1: Install Dependencies ────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --include=dev 2>/dev/null || npm install --include=dev

# ─── Stage 2: Build ───────────────────────────────────────────────
FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ─── Stage 3: Production Server ───────────────────────────────────
FROM node:20-slim AS production
WORKDIR /app

# Only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# Copy built assets + server
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./
COPY --from=build /app/index.html ./

# Non-root user
RUN addgroup --system app && adduser --system --ingroup app app
USER app

# Expose port
ENV PORT=3000
ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
