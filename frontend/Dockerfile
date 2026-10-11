# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
WORKDIR /app
ENV CI=true

# ---- Desarrollo: código montado desde el host, Vite con recarga en caliente ----
FROM base AS dev
COPY package.json ./
RUN npm install
EXPOSE 5173
CMD ["npx", "vite", "--host"]
