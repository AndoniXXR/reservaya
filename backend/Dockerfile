# syntax=docker/dockerfile:1
# Contexto de build: la raíz del monorepo (docker-compose lo indica).

# ---------- Desarrollo: código montado desde el host, recarga con tsx watch ----------
FROM node:24-alpine AS dev
WORKDIR /app
ENV CI=true
COPY backend/package.json ./
RUN npm install
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npx tsx watch src/server.ts"]

# ---------- Dependencias e instalación del workspace ----------
FROM node:24-alpine AS deps
WORKDIR /app
ENV CI=true
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
# Solo el workspace backend (más el root); --ignore-scripts evita el postinstall antes de copiar el esquema
RUN npm ci --workspace backend --ignore-scripts

# ---------- Build: genera el cliente Prisma y compila a dist ----------
FROM deps AS build
COPY backend/ backend/
WORKDIR /app/backend
RUN npx prisma generate && npm run build

# ---------- Migraciones: imagen con la CLI de Prisma (corre y termina) ----------
FROM build AS migrate
WORKDIR /app/backend
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------- Producción: solo dependencias de runtime, usuario sin privilegios ----------
FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production CI=true
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
WORKDIR /app/backend
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
CMD ["node", "dist/server.js"]
