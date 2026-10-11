# ReservaYa

Sistema de gestión de citas en línea para negocios locales (barberías, clínicas, salones).
Los clientes reservan por sí mismos; el negocio administra servicios, profesionales, horarios y estadísticas.

> Proyecto en construcción. La especificación completa y las decisiones técnicas están en
> [`reservaya-especificacion.md`](./reservaya-especificacion.md).

## Stack

React 19 · Vite · Tailwind 4 · TanStack Query · Node 24 · Express 5 · TypeScript · Prisma 7 · PostgreSQL 16 · Docker · Caddy · GitHub Actions · AWS EC2

## Correrlo en local

Requisitos: Node 24, Docker (Docker Engine en WSL 2 sirve; no hace falta Docker Desktop).

```bash
cp .env.example .env
npm install
docker compose up -d db mailpit
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:4000/api/health
- Correos de prueba (Mailpit): http://localhost:8025

También puede levantarse todo en contenedores con `docker compose up`.

### Nota para Windows 10 con Docker en WSL 2

WSL apaga su máquina virtual pocos segundos después de que termine el último proceso, y con ella los contenedores.
Para evitarlo hay que dejar un proceso vivo dentro de la distribución, por ejemplo con una tarea programada al iniciar sesión:

```powershell
schtasks /Create /F /SC ONLOGON /TN "WSL Docker keep-alive" /RL LIMITED /TR "powershell.exe -NoProfile -WindowStyle Hidden -Command \"wsl.exe -d Ubuntu --exec sleep infinity\""
```

## Scripts

| Comando             | Qué hace                                  |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Backend y frontend con recarga en caliente |
| `npm run lint`      | ESLint en todo el monorepo                |
| `npm run typecheck` | `tsc` en backend y frontend               |
| `npm test`          | Pruebas (backend necesita la base `db`)   |
| `npm run format`    | Prettier                                  |
