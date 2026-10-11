# ReservaYa — Especificación técnica completa

> Documento para que un agente de IA construya el proyecto de principio a fin.
> **Instrucción para la IA:** lee este documento completo antes de escribir código. Trabaja **fase por fase** (sección 12), no avances a la siguiente fase hasta cumplir todos los criterios de aceptación de la actual, y al terminar cada fase haz un commit con el mensaje indicado.

---

## 1. Resumen del producto

**ReservaYa** es una aplicación web full stack para que un negocio local (barbería, clínica, taller, salón de belleza) gestione citas en línea.

- **Clientes**: se registran, eligen un servicio, un profesional, una fecha y una hora disponible, y reservan. Pueden ver y cancelar sus citas.
- **Administrador**: gestiona servicios, profesionales, horarios, días libres y citas; ve un panel con estadísticas.
- **Sistema**: envía correos de confirmación y recordatorios automáticos 24 horas antes de cada cita.

**Alcance:** un solo negocio por instalación (no multi-tenant). Interfaz en **español**, zona horaria **America/Guatemala**, moneda **quetzales (Q)**.

**Objetivo del proyecto:** ser una pieza de portafolio con demo pública, código limpio, pruebas automáticas, Docker y despliegue en AWS con CI/CD.

---

## 2. Stack tecnológico (no cambiar sin justificación)

| Capa | Tecnología |
|---|---|
| Lenguaje | **TypeScript** (strict) en backend y frontend |
| Frontend | React 19 + Vite 6, React Router v7 (modo declarativo) |
| Estado del servidor | TanStack Query v5 |
| Formularios | React Hook Form + Zod |
| Estilos | Tailwind CSS v4 |
| Gráficas | Recharts |
| Fechas | date-fns v4 + @date-fns/tz |
| Backend | Node.js 24 LTS + Express 5 |
| ORM | Prisma 7 (con driver adapter `@prisma/adapter-pg`) |
| Base de datos | PostgreSQL 16 |
| Validación backend | Zod v4 |
| Autenticación | JWT (access token) + refresh token en cookie httpOnly, contraseñas con bcrypt |
| Correos | Nodemailer (Mailpit en desarrollo, SMTP real en producción) |
| Tareas programadas | node-cron |
| Documentación API | Swagger / OpenAPI (swagger-ui-express) |
| Logs | pino |
| Pruebas backend | Vitest + Supertest, base de datos de pruebas en Docker |
| Pruebas frontend | Vitest + React Testing Library |
| Calidad | ESLint (flat config) + Prettier |
| Contenedores | Docker + Docker Compose; imágenes publicadas en GitHub Container Registry (GHCR) |
| Proxy / HTTPS | **Caddy 2** (HTTPS automático con Let's Encrypt, sin Certbot) |
| CI/CD | GitHub Actions |
| Hosting | AWS EC2 (Ubuntu 24.04). Verificar la capa gratuita de la cuenta antes de contar con ella y crear una alarma de facturación |

**Entorno de desarrollo local:** Node corre nativo en Windows; Docker (Engine dentro de WSL 2) levanta solo PostgreSQL y Mailpit. El `docker-compose.yml` también define `backend` y `frontend` para poder levantar todo con un comando, pero el flujo diario es `docker compose up db mailpit` + `npm run dev` en cada paquete.

---

## 3. Estructura del repositorio (monorepo)

```
reservaya/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.js
│   ├── src/
│   │   ├── config/          # env, logger, mailer
│   │   ├── middlewares/     # auth, roles, errores, validación, rate limit
│   │   ├── modules/
│   │   │   ├── auth/        # routes, controller, service, schemas
│   │   │   ├── users/
│   │   │   ├── services/
│   │   │   ├── staff/
│   │   │   ├── availability/
│   │   │   ├── appointments/
│   │   │   ├── settings/
│   │   │   └── stats/
│   │   ├── jobs/            # reminders.job.ts
│   │   ├── utils/           # errores, fechas
│   │   ├── app.ts           # crea la app de Express (sin listen)
│   │   └── server.ts        # arranca el servidor y los jobs
│   ├── tests/
│   ├── Dockerfile
│   ├── tsconfig.json
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/             # cliente axios + funciones por recurso
│   │   ├── components/      # UI reutilizable
│   │   ├── features/        # auth, booking, appointments, admin
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/          # rutas protegidas por rol
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── tsconfig.json
│   └── package.json
├── caddy/
│   └── Caddyfile
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
├── docker-compose.yml        # desarrollo
├── docker-compose.prod.yml   # producción
├── .env.example
└── README.md
```

**Patrón en backend:** cada módulo tiene `routes → controller → service`. Los controllers solo manejan HTTP; la lógica de negocio va en los services; Prisma solo se usa dentro de los services.

---

## 4. Modelo de datos (Prisma)

Todas las fechas se guardan en **UTC** en la base de datos. La conversión a hora de Guatemala se hace solo al calcular disponibilidad y al mostrar.

```prisma
enum Role {
  CLIENT
  ADMIN
}

enum AppointmentStatus {
  CONFIRMED
  CANCELLED
  COMPLETED
  NO_SHOW
}

model User {
  id            String        @id @default(uuid())
  name          String
  email         String        @unique
  phone         String?
  passwordHash  String
  role          Role          @default(CLIENT)
  createdAt     DateTime      @default(now())
  appointments  Appointment[]
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(uuid())
  tokenHash String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt    DateTime
  revokedAt    DateTime?
  replacedById String?  // token emitido al rotar; permite el periodo de gracia
  createdAt    DateTime @default(now())
}

model Service {
  id              String         @id @default(uuid())
  name            String
  description     String?
  durationMinutes Int            // múltiplo de slotIntervalMinutes, entre 15 y 240
  price           Decimal        @db.Decimal(10, 2)
  active          Boolean        @default(true)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  staff           StaffService[]
  appointments    Appointment[]
}

model Staff {
  id           String         @id @default(uuid())
  name         String
  bio          String?
  active       Boolean        @default(true)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  services     StaffService[]
  workingHours WorkingHours[]
  timeOff      TimeOff[]
  appointments Appointment[]
}

model StaffService {
  staffId   String
  serviceId String
  staff     Staff   @relation(fields: [staffId], references: [id], onDelete: Cascade)
  service   Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  @@id([staffId, serviceId])
}

model WorkingHours {
  id        String @id @default(uuid())
  staffId   String
  staff     Staff  @relation(fields: [staffId], references: [id], onDelete: Cascade)
  dayOfWeek Int    // 0 = domingo ... 6 = sábado
  startTime String // "09:00" hora local
  endTime   String // "17:00" hora local
  // Puede haber varios bloques por día (ej. 09:00-13:00 y 14:00-18:00)
}

model TimeOff {
  id       String   @id @default(uuid())
  staffId  String
  staff    Staff    @relation(fields: [staffId], references: [id], onDelete: Cascade)
  startsAt DateTime
  endsAt   DateTime
  reason   String?
}

model Appointment {
  id             String            @id @default(uuid())
  clientId       String
  staffId        String
  serviceId      String
  client         User              @relation(fields: [clientId], references: [id])
  staff          Staff             @relation(fields: [staffId], references: [id])
  service        Service           @relation(fields: [serviceId], references: [id])
  startsAt       DateTime
  endsAt         DateTime
  status         AppointmentStatus @default(CONFIRMED)
  priceAtBooking Decimal           @db.Decimal(10, 2) // precio congelado al reservar
  notes          String?
  reminderSentAt DateTime?
  cancelledAt    DateTime?
  cancelledBy    Role?             // quién canceló (CLIENT o ADMIN)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  @@index([staffId, startsAt])
  @@index([clientId])
}

model BusinessSettings {
  id                    Int     @id @default(1) // fila única
  businessName          String  @default("ReservaYa Demo")
  timezone              String  @default("America/Guatemala")
  slotIntervalMinutes   Int     @default(15)
  minAdvanceHours       Int     @default(2)   // no se puede reservar con menos de 2 h
  maxAdvanceDays        Int     @default(30)  // no se puede reservar a más de 30 días
  cancellationHours     Int     @default(12)  // el cliente solo cancela con 12 h de anticipación
  contactPhone          String?
  address               String?
}
```

### 4.1 Protección contra reservas dobles (importante)

Además de validar en el service, crear una **restricción de exclusión en PostgreSQL** mediante una migración SQL manual, para que sea imposible que un profesional tenga dos citas activas que se traslapen, incluso con peticiones simultáneas:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
ADD CONSTRAINT no_overlapping_appointments
EXCLUDE USING gist (
  "staffId" WITH =,
  tstzrange("startsAt", "endsAt", '[)') WITH &&
) WHERE (status IN ('CONFIRMED', 'COMPLETED'));
```

> Nota para la IA: los campos de fecha deben ser `timestamptz` (usar `@db.Timestamptz(3)` en Prisma) para que `tstzrange` funcione. Si la base lanza un error de esta restricción (código `23P01`), el backend debe responder **409 Conflict** con el mensaje "Ese horario acaba de ser reservado, elige otro".

---

## 5. Reglas de negocio

1. Un cliente solo puede reservar servicios **activos** con profesionales **activos** que ofrezcan ese servicio.
2. `endsAt = startsAt + durationMinutes` del servicio.
3. La cita debe caer completamente dentro de un bloque de `WorkingHours` del profesional para ese día.
4. La cita no puede traslaparse con un `TimeOff` del profesional ni con otra cita `CONFIRMED` o `COMPLETED`.
5. No se puede reservar con menos de `minAdvanceHours` ni a más de `maxAdvanceDays` de anticipación.
6. Los horarios de inicio se ofrecen cada `slotIntervalMinutes` (09:00, 09:15, 09:30…).
7. Un cliente puede tener como máximo **5 citas futuras confirmadas** a la vez. Esta regla se comprueba **dentro de la misma transacción** que inserta la cita, tomando un bloqueo por cliente (`SELECT ... FOR UPDATE` sobre la fila del usuario), para que dos peticiones simultáneas no la superen.
8. El cliente puede cancelar solo si faltan al menos `cancellationHours`. El admin puede cancelar siempre. Se guarda quién canceló en `cancelledBy`.
9. Solo el admin puede marcar una cita como `COMPLETED` o `NO_SHOW`, y solo si la hora de inicio ya pasó.
10. El precio se copia a `priceAtBooking` al reservar; cambiar el precio del servicio no afecta citas existentes.
11. Desactivar un servicio o profesional no borra sus citas; solo impide nuevas reservas.
12. No se borra nada físicamente salvo `WorkingHours` y `TimeOff`; lo demás se desactiva o cancela.
13. **Citas existentes frente a cambios del admin.** Cambiar el horario semanal, añadir un día libre o desactivar a un profesional **no modifica** las citas ya confirmadas. La API devuelve en la respuesta la lista de citas afectadas (`affectedAppointments`) y la UI las muestra con un aviso para que el admin decida cancelarlas una por una.
14. `durationMinutes` de un servicio debe ser múltiplo de `slotIntervalMinutes`; al reducir `slotIntervalMinutes` en la configuración se valida que todos los servicios activos sigan cumpliéndolo.

---

## 6. Algoritmo de disponibilidad

Endpoint: `GET /api/availability?serviceId=&staffId=&date=YYYY-MM-DD`
(`staffId` opcional: si no viene, devolver los horarios de todos los profesionales que ofrecen el servicio, indicando cuál.)

Pasos:

1. Cargar `BusinessSettings` y el servicio (duración).
2. Interpretar `date` en la zona horaria del negocio.
3. Obtener los bloques de `WorkingHours` del profesional para ese `dayOfWeek`.
4. Para cada bloque, generar horas de inicio candidatas cada `slotIntervalMinutes`, donde `inicio + duración <= fin del bloque`.
5. Convertir cada candidato a UTC.
6. Descartar candidatos que:
   - empiecen antes de `ahora + minAdvanceHours`;
   - empiecen después de `ahora + maxAdvanceDays`;
   - se traslapen con algún `TimeOff`;
   - se traslapen con alguna cita `CONFIRMED`/`COMPLETED` del profesional.
   - Traslape: `inicioA < finB && inicioB < finA`.
7. Devolver:

```json
{
  "date": "2026-11-03",
  "timezone": "America/Guatemala",
  "slots": [
    { "staffId": "…", "staffName": "Carlos", "startsAt": "2026-11-03T15:00:00.000Z", "label": "09:00" }
  ]
}
```

Esta función debe estar aislada en `availability.service.js` como función pura (recibe datos, devuelve slots) para poder probarla con pruebas unitarias sin base de datos.

---

## 7. Autenticación y seguridad

- **Registro** público solo crea usuarios `CLIENT`. El admin se crea con el seed.
- Contraseña: mínimo 8 caracteres, al menos una letra y un número. Hash con bcrypt (cost 12).
- **Access token** JWT de 15 minutos, enviado en el header `Authorization: Bearer`. Contiene `sub` (id) y `role`.
- **Refresh token** aleatorio de 7 días, guardado como hash en `RefreshToken` y enviado en cookie `httpOnly`, `secure` (en producción), `sameSite=strict`, ruta `/api/auth`.
- `POST /api/auth/refresh` rota el refresh token (revoca el anterior y emite uno nuevo). **Periodo de gracia:** un token revocado por rotación sigue aceptándose durante 30 segundos y devuelve el mismo token nuevo ya emitido (guardar `replacedById`). Esto evita cerrar la sesión cuando dos pestañas, o el doble montaje de React en desarrollo, refrescan a la vez. Un token revocado fuera de la gracia o por logout → 401 y se revocan todos los tokens del usuario (posible robo).
- Logout revoca el refresh token y borra la cookie.
- El frontend guarda el access token **en memoria** (no en localStorage). Al cargar la app llama a `/refresh` para recuperar la sesión. El interceptor de axios reintenta una vez tras un 401 llamando a `/refresh`, con una **única promesa compartida**: si varias peticiones fallan a la vez, solo una llama a `/refresh` y las demás esperan su resultado.
- Middlewares: `requireAuth`, `requireRole('ADMIN')`.
- `helmet`, CORS restringido al dominio del frontend, `app.set('trust proxy', 1)` porque va detrás de Caddy.
- `express-rate-limit` **solo en `/api/auth/login` y `/api/auth/register`** (10 peticiones / 15 min por IP). No se limita `/refresh` ni `/me`, que el frontend llama en cada carga.
- Toda entrada se valida con Zod; errores de validación devuelven 400 con detalle por campo.
- Nunca devolver `passwordHash` ni tokens en respuestas JSON.
- Variables sensibles solo en `.env` (nunca en el repositorio).

---

## 8. API REST

Prefijo `/api`. Respuestas en JSON. Formato de error uniforme:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Datos inválidos", "details": { "email": "Correo inválido" } } }
```

Códigos: 400 validación, 401 no autenticado, 403 sin permiso, 404 no existe, 409 conflicto, 422 regla de negocio, 429 rate limit, 500 error interno.

Listados paginados con `?page=1&pageSize=20`, respuesta `{ data, page, pageSize, total }`.

### Auth
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | /auth/register | Público | Registro de cliente |
| POST | /auth/login | Público | Devuelve access token + cookie refresh |
| POST | /auth/refresh | Cookie | Rota tokens |
| POST | /auth/logout | Autenticado | Cierra sesión |
| GET | /auth/me | Autenticado | Usuario actual |
| PATCH | /auth/me | Autenticado | Editar nombre y teléfono |

### Servicios
| Método | Ruta | Acceso |
|---|---|---|
| GET | /services | Público (solo activos; admin puede pasar `?all=true`) |
| GET | /services/:id | Público |
| POST | /services | Admin |
| PATCH | /services/:id | Admin |
| PATCH | /services/:id/toggle | Admin (activar/desactivar) |

### Profesionales
| Método | Ruta | Acceso |
|---|---|---|
| GET | /staff?serviceId= | Público (activos que ofrecen el servicio) |
| GET | /staff/:id | Público |
| POST | /staff | Admin |
| PATCH | /staff/:id | Admin (incluye `serviceIds`) |
| PATCH | /staff/:id/toggle | Admin |
| GET | /staff/:id/working-hours | Admin |
| PUT | /staff/:id/working-hours | Admin (reemplaza todos los bloques; validar que no se traslapen) |
| GET | /staff/:id/time-off | Admin |
| POST | /staff/:id/time-off | Admin |
| DELETE | /time-off/:id | Admin |

### Disponibilidad
| Método | Ruta | Acceso |
|---|---|---|
| GET | /availability?serviceId=&staffId=&date= | Público |

### Citas
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | /appointments | Cliente | Crear cita `{ serviceId, staffId, startsAt, notes? }` |
| GET | /appointments/mine?scope=upcoming\|past | Cliente | Mis citas |
| PATCH | /appointments/:id/cancel | Cliente dueño o Admin | Cancelar |
| GET | /appointments?from=&to=&staffId=&status= | Admin | Listado filtrado |
| PATCH | /appointments/:id/status | Admin | `COMPLETED` o `NO_SHOW` |

### Configuración
| Método | Ruta | Acceso |
|---|---|---|
| GET | /settings | Público (datos públicos del negocio) |
| PATCH | /settings | Admin |

### Estadísticas (Admin)
`GET /stats/overview?from=&to=` devuelve:
- total de citas por estado;
- ingresos estimados (suma de `priceAtBooking` de citas `COMPLETED`);
- tasa de ocupación por profesional (minutos reservados / minutos laborables del periodo);
- citas por día (para gráfica de líneas);
- servicios más reservados (top 5);
- tasa de inasistencia (`NO_SHOW` / (`COMPLETED` + `NO_SHOW`)).

### Salud
`GET /health` → `{ status: "ok", db: "ok" }` (verifica conexión a la base).

Documentar todos los endpoints en Swagger en `/api/docs`.

---

## 9. Correos y recordatorios

Plantillas HTML sencillas en español con el nombre del negocio:

1. **Confirmación** al crear la cita: servicio, profesional, fecha y hora local, dirección, enlace a "Mis citas".
2. **Cancelación** cuando se cancela (indicar si la canceló el negocio).
3. **Recordatorio** 24 h antes.

Job con node-cron cada 10 minutos:
- buscar citas `CONFIRMED` con `startsAt` entre `ahora + 23 h` y `ahora + 25 h` y `reminderSentAt IS NULL`;
- **reclamar antes de enviar:** `UPDATE ... SET reminderSentAt = now() WHERE id = ? AND reminderSentAt IS NULL RETURNING *`; solo si la fila vuelve se envía el correo. Así dos ejecuciones del job nunca mandan dos recordatorios;
- si el envío falla, registrar con pino y volver a poner `reminderSentAt = NULL` para reintentar en la siguiente pasada.

El envío de correos no debe bloquear la respuesta HTTP (enviar después de responder y capturar errores). En desarrollo usar **Mailpit** (contenedor en docker-compose, interfaz en `http://localhost:8025`).

---

## 10. Frontend

### 10.1 Páginas públicas
- **Inicio** (`/`): nombre del negocio, descripción breve, lista de servicios con precio y duración, botón "Reservar".
- **Login** (`/login`) y **Registro** (`/registro`).

### 10.2 Flujo de reserva (`/reservar`) — asistente de 4 pasos
1. Elegir servicio (tarjetas).
2. Elegir profesional (o "Cualquiera disponible").
3. Elegir fecha (calendario que deshabilita días pasados y fuera de `maxAdvanceDays`) y hora (botones con los slots disponibles; mensaje claro si no hay).
4. Confirmar: resumen, campo de notas, botón "Confirmar reserva".

Si el usuario no ha iniciado sesión al llegar al paso 4, redirigir a login y volver al paso 4 conservando la selección. Si el backend responde 409, mostrar el mensaje y recargar los horarios.

Pantalla final de éxito con resumen y enlace a "Mis citas".

### 10.3 Área de cliente
- **Mis citas** (`/mis-citas`): pestañas "Próximas" y "Historial"; botón cancelar con diálogo de confirmación (deshabilitado si ya no se puede cancelar, con explicación).
- **Mi perfil** (`/perfil`): editar nombre y teléfono.

### 10.4 Panel de administración (`/admin`, solo rol ADMIN)
- **Dashboard**: tarjetas con métricas (citas de hoy, de la semana, ingresos del mes, tasa de inasistencia), gráfica de citas por día, gráfica de barras de ocupación por profesional, top servicios. Selector de rango de fechas.
- **Agenda**: vista **por día**, columnas por profesional, citas coloreadas por estado, navegación día anterior / hoy / siguiente. Al hacer clic, ver detalle y acciones (cancelar, marcar completada / no asistió). La vista semanal queda como mejora opcional (sección 16).
- **Citas**: tabla con filtros (fecha, profesional, estado) y paginación.
- **Servicios**: tabla + formulario de crear/editar, activar/desactivar.
- **Profesionales**: tabla + formulario (nombre, bio, servicios que ofrece), editor de horario semanal (bloques por día) y gestión de días libres.
- **Configuración**: formulario de `BusinessSettings`.

### 10.5 Requisitos de UI
- Diseño responsive (debe usarse bien en celular, que es como reservarán los clientes).
- Estados de carga (skeletons), estados vacíos y mensajes de error en todas las pantallas.
- Notificaciones tipo toast para acciones exitosas o fallidas.
- Formatos: fechas como "martes 3 de noviembre, 09:00", precios como "Q 150.00".
- Accesibilidad básica: etiquetas en formularios, foco visible, contraste adecuado.
- Rutas protegidas: redirigir a `/login` si no hay sesión y a `/` si el rol no corresponde.

---

## 11. Datos de prueba (seed)

`npm run seed` debe crear:
- Admin: `admin@reservaya.demo` / `Admin1234`
- Cliente: `cliente@reservaya.demo` / `Cliente1234`
- 5 clientes adicionales con datos ficticios.
- Negocio: "Barbería El Centro", dirección ficticia en Ciudad de Guatemala.
- Servicios: Corte clásico (30 min, Q75), Corte + barba (45 min, Q110), Afeitado con toalla caliente (30 min, Q60), Diseño de barba (15 min, Q40), Tratamiento capilar (60 min, Q150).
- 3 profesionales con distintos servicios y horarios (uno de lunes a viernes 9-18 con almuerzo 13-14, otro de martes a sábado 10-19, otro solo fines de semana).
- Un día libre para uno de ellos la próxima semana.
- ~60 citas distribuidas en las últimas 4 semanas (mezcla de COMPLETED, NO_SHOW, CANCELLED) y ~15 en las próximas 2 semanas, sin traslapes, para que el dashboard tenga datos.

El seed debe poder ejecutarse varias veces (limpia y vuelve a crear). El cliente demo `cliente@reservaya.demo` debe quedar con como máximo 2 citas futuras para que siempre pueda reservar.

### 11.1 Modo demo (`DEMO_MODE=true`)

Como la demo es pública con credenciales de admin publicadas, el backend tiene un modo demo que:
- reinicia el seed todas las noches a las 03:00 (job de node-cron);
- rechaza con 403 cambiar la contraseña o el correo del admin, y `PATCH /settings` sobre `businessName` y `timezone`;
- envía **todos** los correos a Mailpit (nunca a un SMTP real), y Caddy expone la interfaz de Mailpit en `/mailpit` para que quien pruebe la demo vea los correos que recibiría. Así nadie puede usar la demo para mandar correos a terceros.
- muestra un aviso discreto en la UI: "Demo pública: los datos se reinician cada noche".

---

## 12. Plan de trabajo por fases

### Fase 1 — Base del proyecto
- Crear monorepo (npm workspaces), TypeScript strict, ESLint flat config, Prettier, `.gitignore`, `.env.example`.
- `docker-compose.yml` con `db` (PostgreSQL 16), `mailpit`, `backend` y `frontend` (con recarga en caliente usando polling, por los bind mounts desde Windows).
- Express 5 con `helmet`, CORS, pino, manejador de errores global, `/api/health`.
- Vite + React 19 + Tailwind 4 + React Router 7 con una página de prueba.

**Criterios:** `docker compose up db mailpit` + `npm run dev` levanta todo; `docker compose up` (completo) también; `/api/health` responde ok; el frontend carga en `http://localhost:5173`; `npm run lint` y `npm run typecheck` pasan.
**Commit:** `chore: estructura inicial del proyecto con docker`

### Fase 2 — Base de datos
- `schema.prisma` completo, migración inicial y migración SQL de la restricción de exclusión.
- Seed completo.

**Criterios:** migraciones aplican sin error; el seed crea todos los datos; insertar manualmente dos citas traslapadas falla.
**Commit:** `feat: modelo de datos, restricciones y datos de prueba`

### Fase 3 — Autenticación
- Endpoints de auth, middlewares, rate limit.
- Frontend: login, registro, contexto de sesión, interceptor de axios, rutas protegidas.
- Pruebas de integración de auth.

**Criterios:** registro, login, refresh, logout y `/me` funcionan; cliente no puede acceder a rutas admin (403); pruebas pasan.
**Commit:** `feat: autenticación con JWT y refresh tokens`

### Fase 4 — Servicios, profesionales y horarios (admin)
- CRUD de servicios y profesionales, horarios y días libres.
- Pantallas de admin correspondientes.

**Criterios:** el admin puede crear/editar todo desde la UI; validaciones de horarios traslapados funcionan.
**Commit:** `feat: gestión de servicios, profesionales y horarios`

### Fase 5 — Disponibilidad y reservas
- Función pura de disponibilidad con pruebas unitarias exhaustivas (ver sección 13).
- Endpoints de citas con todas las reglas de la sección 5.
- Asistente de reserva y "Mis citas" en el frontend.

**Criterios:** un cliente reserva de punta a punta; no aparecen horarios ocupados; dos reservas simultáneas al mismo horario producen una exitosa y un 409; cancelación respeta `cancellationHours`; cinco peticiones simultáneas de un cliente con 4 citas futuras producen exactamente una exitosa.
**Commit:** `feat: cálculo de disponibilidad y flujo de reservas`

### Fase 6 — Correos y recordatorios
- Mailer, plantillas, job de recordatorios.

**Criterios:** al reservar y cancelar llegan correos a Mailpit; el job envía recordatorios una sola vez por cita.
**Commit:** `feat: correos de confirmación y recordatorios automáticos`

### Fase 7 — Panel de administración
- Agenda, tabla de citas, cambio de estado, estadísticas y dashboard con gráficas.

**Criterios:** el dashboard muestra datos del seed coherentes; los filtros funcionan; las métricas coinciden con consultas manuales.
**Commit:** `feat: panel de administración y estadísticas`

### Fase 8 — Calidad
- Completar pruebas (cobertura mínima 70 % en backend; en disponibilidad, todos los casos de la sección 13 sin exigir un porcentaje).
- Swagger completo.
- Revisión de responsive, estados vacíos, errores y accesibilidad.

**Criterios:** `npm test` pasa en ambos proyectos; `/api/docs` documenta todo; la app se usa bien en un ancho de 375 px.
**Commit:** `test: cobertura de pruebas y documentación de la API`

### Fase 9 — Producción y despliegue
- Dockerfiles multi-etapa (frontend compilado y servido por Caddy; backend con `node` no root).
- `docker-compose.prod.yml` con `db` (volumen persistente), `migrate` (corre `prisma migrate deploy` y termina), `backend` (depende de `migrate` con `condition: service_completed_successfully`), `mailpit` (solo en modo demo) y `caddy` (sirve el frontend, proxy de `/api`, HTTPS automático).
- Workflow `ci.yml`: en cada push y pull request ejecuta lint, typecheck, pruebas (con servicio de PostgreSQL) y build.
- Workflow `deploy.yml`: en push a `main`, si CI pasa, **construye las imágenes en GitHub Actions y las publica en GHCR**; después se conecta por SSH a EC2 y ejecuta `docker compose -f docker-compose.prod.yml pull && up -d`. EC2 nunca compila (una instancia pequeña no tiene memoria para Vite).
- Guía en el README para: crear instancia EC2, abrir puertos 22/80/443, instalar Docker, apuntar un dominio (o subdominio gratuito) y dejar que Caddy obtenga el certificado.
- Backup diario de la base con `pg_dump` vía cron en el servidor (retener 7 días).

**Criterios:** la app está en línea con HTTPS; un push a `main` despliega automáticamente; las credenciales de demo funcionan.
**Commit:** `ci: pipeline de integración y despliegue en AWS`

### Fase 10 — README y presentación
Ver sección 14.
**Commit:** `docs: README completo con capturas y demo`

---

## 13. Pruebas obligatorias

**Unitarias — disponibilidad** (casos mínimos):
- día sin horario laboral → sin slots;
- bloque 09:00-12:00, servicio de 30 min, intervalo 15 → último slot 11:30;
- dos bloques con almuerzo → no hay slots que crucen el almuerzo;
- cita existente 10:00-10:45 → no aparecen 09:45 (para servicio de 30 min), 10:00, 10:15, 10:30; sí aparece 10:45;
- citas canceladas no bloquean horarios;
- día libre que cubre parte del día;
- respeto de `minAdvanceHours` cuando la fecha es hoy;
- fecha fuera de `maxAdvanceDays` → sin slots;
- conversión correcta de zona horaria (Guatemala, UTC-6).

**Integración — API:**
- registro duplicado → 409;
- login inválido → 401;
- cliente intentando crear servicio → 403;
- reserva válida → 201 y correo encolado;
- reserva en horario ocupado → 409;
- reserva fuera de horario laboral → 422;
- sexta cita futura → 422;
- refresh con token recién rotado (dentro de la gracia) → 200 con el mismo token nuevo; fuera de la gracia → 401;
- cancelación tardía por cliente → 422; por admin → 200;
- **concurrencia:** 5 peticiones simultáneas al mismo horario → exactamente 1 éxito.

**Frontend:**
- formulario de login muestra errores de validación;
- el asistente de reserva avanza y conserva la selección;
- rutas protegidas redirigen correctamente.

---

## 14. README del repositorio

Debe incluir:
1. Nombre, descripción en dos líneas y **enlace a la demo**.
2. Credenciales de prueba (admin y cliente).
3. Capturas o GIF: inicio, flujo de reserva en móvil, dashboard, agenda.
4. Funcionalidades principales.
5. Stack tecnológico.
6. Diagrama de arquitectura (Mermaid): navegador → Nginx → React / API Express → PostgreSQL, más el job de recordatorios y el SMTP.
7. Diagrama entidad-relación (Mermaid).
8. Decisiones técnicas destacadas: restricción de exclusión contra reservas dobles, manejo de zonas horarias, rotación de refresh tokens, función pura de disponibilidad.
9. Cómo correrlo localmente (`docker compose up`, migraciones, seed).
10. Cómo correr las pruebas.
11. Enlace a la documentación de la API.
12. Próximas mejoras (ver sección 16).

---

## 15. Reglas para el agente de IA

- Sigue el stack y la estructura indicados; si necesitas una dependencia adicional, justifícala en el mensaje del commit.
- No avances de fase sin cumplir los criterios de aceptación; ejecuta las pruebas antes de cada commit.
- Código y nombres de variables en **inglés**; textos de la interfaz, correos y mensajes de error al usuario en **español**.
- Funciones pequeñas, sin lógica de negocio en controllers ni en componentes de React.
- No dejes `console.log`, código comentado ni TODOs sin resolver.
- Nunca subas secretos; usa `.env` y documenta cada variable en `.env.example`.
- Maneja todos los errores (try/catch en servicios externos, manejador global en Express, error boundaries en React).
- Cuando algo de esta especificación sea ambiguo, elige la opción más simple y anótala en una sección "Decisiones" del README.
- Al terminar cada fase, resume: qué se hizo, cómo probarlo y qué queda pendiente.

---

## 16. Mejoras opcionales (después de terminar)

- Recordatorios por WhatsApp (API de WhatsApp Business o Twilio).
- Exportar citas a CSV.
- Recuperación de contraseña por correo.
- Reprogramar cita (en lugar de cancelar y volver a reservar).
- Lista de espera cuando un día está lleno.
- Vista semanal en la agenda del admin.
- Modo multi-negocio (multi-tenant).

---

## 17. Cómo quedará en el CV

> **ReservaYa — Sistema de Gestión de Citas** · [demo] · [repo]
> - Desarrollé una aplicación web full stack para que negocios locales gestionen citas en línea, con roles de cliente y administrador.
> - Implementé el cálculo de disponibilidad por profesional y una restricción en PostgreSQL que impide reservas dobles incluso con peticiones simultáneas.
> - Añadí autenticación JWT con rotación de tokens, recordatorios automáticos por correo y un panel de estadísticas de ocupación.
> - Desplegué con Docker en AWS EC2 con integración y despliegue continuo en GitHub Actions.
> - Tecnologías: React, Node.js, Express, PostgreSQL, Prisma, Docker, AWS.

---

## 18. Lo que tú debes poder explicar en una entrevista

Aunque la IA escriba el código, revisa y entiende al menos esto (te lo van a preguntar):
1. Cómo funciona el algoritmo de disponibilidad y por qué las fechas se guardan en UTC.
2. Qué es la restricción de exclusión y por qué la validación en código no basta ante peticiones simultáneas.
3. Diferencia entre access token y refresh token, y por qué el refresh va en cookie httpOnly.
4. Cómo está organizado el backend (routes → controller → service) y por qué.
5. Qué hace cada paso del pipeline de GitHub Actions.
6. Cómo se despliega en EC2 y qué hace Caddy.

---

## 19. Decisiones tomadas sobre la especificación original

Cambios respecto a la primera versión del documento, con su motivo. Sirven también de guion para la entrevista.

| Cambio | Motivo |
|---|---|
| TypeScript en vez de JavaScript | Prisma y Zod generan los tipos casi gratis; evita errores de fechas y decimales; es lo que piden las ofertas |
| Node 24, React 19, Router 7, Express 5, Prisma 7, Tailwind 4, Zod 4 con versiones fijadas | Node 20 salió de soporte en abril de 2026; las versiones abiertas provocan mezcla de sintaxis entre mayores |
| Caddy en lugar de Nginx + Certbot | HTTPS automático con dos líneas; elimina la parte más frágil del despliegue |
| Rate limit solo en login y registro | Limitar `/refresh` y `/me` bloqueaba a usuarios normales al recargar; además todos comparten IP detrás del proxy |
| Promesa única de refresh + gracia de 30 s en la rotación | Dos peticiones simultáneas con 401 (o el doble montaje de React) llamaban dos veces a `/refresh` y cerraban la sesión |
| Límite de citas futuras dentro de la transacción con bloqueo por cliente | La restricción de exclusión impide solapes, pero no limita el número de citas; sin bloqueo, peticiones simultáneas a horarios distintos lo superaban |
| Límite subido de 3 a 5 citas futuras | Con 3, el cliente demo se quedaba sin cupo para probar la reserva |
| Regla 13: cambios del admin no tocan citas existentes, solo las señalan | Es la opción más simple y la más honesta; cancelar automáticamente sorprendería a clientes |
| Reclamar el recordatorio con `UPDATE ... RETURNING` antes de enviar | Dos ejecuciones cruzadas del job podían mandar dos recordatorios |
| Imágenes construidas en GitHub Actions y publicadas en GHCR | Una EC2 pequeña se queda sin memoria compilando Vite; además el despliegue pasa a ser `pull`, mucho más rápido |
| Contenedor `migrate` antes del backend | Las migraciones deben aplicarse antes de que arranque el código nuevo, no después |
| Modo demo (`DEMO_MODE`) | Admin público + SMTP real permitía sabotear la demo y mandar correos a terceros; ahora los datos se reinician y los correos van a Mailpit visible |
| Agenda solo por día; semanal como opcional | Era la pantalla más cara y la vista semanal no muestra nada que la diaria no enseñe |
| Sin exigir 100 % de cobertura en disponibilidad | Los casos de la sección 13 ya son exhaustivos; el número fuerza pruebas inútiles |
| Proyecto en Windows, Docker solo para PostgreSQL y Mailpit en el día a día | Node nativo es más rápido y el rendimiento de disco de WSL deja de importar |
