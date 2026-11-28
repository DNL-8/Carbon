FROM oven/bun:1.4.5 AS bun
FROM node:24-bookworm-slim
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY frontend/package.json frontend/bun.lock ./frontend/
WORKDIR /app/frontend
RUN bun install --frozen-lockfile
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY frontend ./frontend
WORKDIR /app/frontend
RUN bun run build && chown -R node:node /app/frontend
ENV NODE_ENV=production
ENV PORT=8080
USER node
EXPOSE 8080
CMD ["sh", "-c", "exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port \"$PORT\""]
