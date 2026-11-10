FROM oven/bun:1.3.14-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY src ./src
COPY tsconfig.json ./
RUN bun run build

FROM oven/bun:1.3.14-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
ENV PORT=3000
USER bun
EXPOSE 3000
CMD ["bun", "dist/index.js"]
