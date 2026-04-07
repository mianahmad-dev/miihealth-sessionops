# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

# Build tools required by better-sqlite3 native module
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ─── Stage 3: Runtime ─────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN mkdir -p /data

# App source needed by next start
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/src ./src
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# node_modules from deps stage (compiled for linux, correct architecture)
COPY --from=deps /app/node_modules ./node_modules

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
