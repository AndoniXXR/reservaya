# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
WORKDIR /app
ENV CI=true

# ---- Desarrollo: código montado desde el host, recarga con tsx watch ----
FROM base AS dev
COPY package.json ./
RUN npm install
CMD ["npx", "tsx", "watch", "src/server.ts"]
