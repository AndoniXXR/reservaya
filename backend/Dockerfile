# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
WORKDIR /app
ENV CI=true

# ---- Desarrollo: código montado desde el host, recarga con tsx watch ----
FROM base AS dev
COPY package.json ./
RUN npm install
# Genera el cliente Prisma y aplica migraciones pendientes antes de arrancar
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npx tsx watch src/server.ts"]
