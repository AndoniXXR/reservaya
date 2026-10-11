# syntax=docker/dockerfile:1
# Contexto de build: la raíz del monorepo.

# ---------- Desarrollo: código montado desde el host, Vite con recarga en caliente ----------
FROM node:24-alpine AS dev
WORKDIR /app
ENV CI=true
COPY frontend/package.json ./
RUN npm install
EXPOSE 5173
CMD ["npx", "vite", "--host"]

# ---------- Build: compila el frontend ----------
FROM node:24-alpine AS build
WORKDIR /app
ENV CI=true
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace frontend --ignore-scripts
COPY frontend/ frontend/
# En producción el frontend y la API comparten origen a través de Caddy
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w frontend

# ---------- Producción: Caddy sirve el frontend y hace proxy de /api ----------
FROM caddy:2-alpine AS production
COPY caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/frontend/dist /srv
EXPOSE 80 443
