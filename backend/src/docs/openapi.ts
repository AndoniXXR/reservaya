/**
 * Documento OpenAPI 3.1 de la API. Se sirve en /api/docs (Swagger UI) y /api/docs.json.
 * Se mantiene a mano para no acoplar la validación (Zod) a la documentación.
 */

const uuid = { type: 'string', format: 'uuid' } as const;
const dateTime = { type: 'string', format: 'date-time' } as const;
const date = { type: 'string', format: 'date', example: '2026-11-03' } as const;

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const json = (schema: unknown, description = 'OK') => ({
  description,
  content: { 'application/json': { schema } },
});

const body = (schema: unknown) => ({
  required: true,
  content: { 'application/json': { schema } },
});

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: uuid,
} as const;

const auth = [{ bearerAuth: [] }];

const common = {
  401: errorResponse('No autenticado'),
  403: errorResponse('Sin permiso'),
  404: errorResponse('No existe'),
  400: errorResponse('Datos inválidos (details por campo)'),
  422: errorResponse('Regla de negocio incumplida'),
};

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'ReservaYa API',
    version: '1.0.0',
    description:
      'API del sistema de gestión de citas. Todas las fechas van en ISO 8601 (UTC); la zona del negocio se usa para calcular disponibilidad. ' +
      'Errores con formato uniforme `{ error: { code, message, details? } }`.',
  },
  servers: [{ url: '/api' }],
  tags: [
    { name: 'Auth' },
    { name: 'Servicios' },
    { name: 'Profesionales' },
    { name: 'Disponibilidad' },
    { name: 'Citas' },
    { name: 'Configuración' },
    { name: 'Estadísticas' },
    { name: 'Salud' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      refreshCookie: { type: 'apiKey', in: 'cookie', name: 'refresh_token' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                enum: [
                  'VALIDATION_ERROR',
                  'UNAUTHORIZED',
                  'FORBIDDEN',
                  'NOT_FOUND',
                  'CONFLICT',
                  'BUSINESS_RULE',
                  'RATE_LIMITED',
                  'INTERNAL_ERROR',
                ],
              },
              message: { type: 'string' },
              details: { type: 'object', additionalProperties: { type: 'string' } },
            },
            required: ['code', 'message'],
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: uuid,
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: ['string', 'null'] },
          role: { type: 'string', enum: ['CLIENT', 'ADMIN'] },
          createdAt: dateTime,
        },
      },
      Session: {
        type: 'object',
        properties: { user: ref('User'), accessToken: { type: 'string' } },
        description:
          'El refresh token viaja en la cookie httpOnly `refresh_token` (ruta /api/auth)',
      },
      RegisterInput: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 80 },
          email: { type: 'string', format: 'email' },
          phone: { type: ['string', 'null'] },
          password: {
            type: 'string',
            minLength: 8,
            description: 'Al menos una letra y un número',
          },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string' }, password: { type: 'string' } },
      },
      Service: {
        type: 'object',
        properties: {
          id: uuid,
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
          durationMinutes: { type: 'integer', description: 'Múltiplo de slotIntervalMinutes' },
          price: { type: 'number', example: 75 },
          active: { type: 'boolean' },
        },
      },
      ServiceInput: {
        type: 'object',
        required: ['name', 'durationMinutes', 'price'],
        properties: {
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
          durationMinutes: { type: 'integer', minimum: 15, maximum: 240 },
          price: { type: 'number', exclusiveMinimum: 0 },
        },
      },
      Staff: {
        type: 'object',
        properties: {
          id: uuid,
          name: { type: 'string' },
          bio: { type: ['string', 'null'] },
          active: { type: 'boolean' },
          services: { type: 'array', items: ref('Service') },
        },
      },
      StaffInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          bio: { type: ['string', 'null'] },
          serviceIds: { type: 'array', items: uuid },
        },
      },
      WorkingHoursBlock: {
        type: 'object',
        required: ['dayOfWeek', 'startTime', 'endTime'],
        properties: {
          dayOfWeek: { type: 'integer', minimum: 0, maximum: 6, description: '0 = domingo' },
          startTime: { type: 'string', example: '09:00' },
          endTime: { type: 'string', example: '13:00' },
        },
      },
      WorkingHours: {
        allOf: [
          ref('WorkingHoursBlock'),
          { type: 'object', properties: { id: uuid, staffId: uuid } },
        ],
      },
      TimeOff: {
        type: 'object',
        properties: {
          id: uuid,
          staffId: uuid,
          startsAt: dateTime,
          endsAt: dateTime,
          reason: { type: ['string', 'null'] },
        },
      },
      TimeOffInput: {
        type: 'object',
        required: ['startsAt', 'endsAt'],
        properties: { startsAt: dateTime, endsAt: dateTime, reason: { type: ['string', 'null'] } },
      },
      AffectedAppointment: {
        type: 'object',
        description:
          'Cita confirmada que queda fuera del nuevo horario / día libre. No se modifica: el admin decide.',
        properties: {
          id: uuid,
          startsAt: dateTime,
          endsAt: dateTime,
          clientName: { type: 'string' },
          serviceName: { type: 'string' },
        },
      },
      Slot: {
        type: 'object',
        properties: {
          staffId: uuid,
          staffName: { type: 'string' },
          startsAt: dateTime,
          label: { type: 'string', example: '09:00', description: 'Hora local del negocio' },
        },
      },
      Availability: {
        type: 'object',
        properties: {
          date,
          timezone: { type: 'string', example: 'America/Guatemala' },
          slots: { type: 'array', items: ref('Slot') },
        },
      },
      AppointmentStatus: {
        type: 'string',
        enum: ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'],
      },
      Appointment: {
        type: 'object',
        properties: {
          id: uuid,
          startsAt: dateTime,
          endsAt: dateTime,
          status: ref('AppointmentStatus'),
          priceAtBooking: { type: 'number', description: 'Precio congelado al reservar' },
          notes: { type: ['string', 'null'] },
          service: {
            type: 'object',
            properties: {
              id: uuid,
              name: { type: 'string' },
              durationMinutes: { type: 'integer' },
            },
          },
          staff: { type: 'object', properties: { id: uuid, name: { type: 'string' } } },
          client: {
            type: 'object',
            properties: {
              id: uuid,
              name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: ['string', 'null'] },
            },
          },
          cancelledAt: { ...dateTime, nullable: true },
          cancelledBy: { type: ['string', 'null'], enum: ['CLIENT', 'ADMIN', null] },
          createdAt: dateTime,
        },
      },
      CreateAppointmentInput: {
        type: 'object',
        required: ['serviceId', 'staffId', 'startsAt'],
        properties: {
          serviceId: uuid,
          staffId: uuid,
          startsAt: { ...dateTime, description: 'Debe ser uno de los slots de /availability' },
          notes: { type: ['string', 'null'], maxLength: 300 },
        },
      },
      Settings: {
        type: 'object',
        properties: {
          businessName: { type: 'string' },
          timezone: { type: 'string' },
          slotIntervalMinutes: { type: 'integer', enum: [15, 30, 60] },
          minAdvanceHours: { type: 'integer' },
          maxAdvanceDays: { type: 'integer' },
          cancellationHours: { type: 'integer' },
          contactPhone: { type: ['string', 'null'] },
          address: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] },
        },
      },
      StatsOverview: {
        type: 'object',
        properties: {
          range: { type: 'object', properties: { from: date, to: date } },
          totalsByStatus: {
            type: 'object',
            additionalProperties: { type: 'integer' },
            example: { CONFIRMED: 13, CANCELLED: 6, COMPLETED: 36, NO_SHOW: 10 },
          },
          revenue: { type: 'number' },
          noShowRate: { type: ['number', 'null'], description: 'NO_SHOW / (COMPLETED + NO_SHOW)' },
          occupancyByStaff: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                staffId: uuid,
                staffName: { type: 'string' },
                bookedMinutes: { type: 'integer' },
                workingMinutes: { type: 'integer' },
                rate: { type: 'number' },
              },
            },
          },
          appointmentsPerDay: {
            type: 'array',
            items: { type: 'object', properties: { date, count: { type: 'integer' } } },
          },
          topServices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                serviceId: uuid,
                serviceName: { type: 'string' },
                count: { type: 'integer' },
              },
            },
          },
          highlights: {
            type: 'object',
            properties: {
              today: { type: 'integer' },
              thisWeek: { type: 'integer' },
              monthRevenue: { type: 'number' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Salud'],
        summary: 'Estado de la API y la base de datos',
        responses: {
          200: json({
            type: 'object',
            properties: { status: { type: 'string' }, db: { type: 'string' } },
          }),
          503: json({ type: 'object' }, 'Base de datos no disponible'),
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Registro de cliente (siempre rol CLIENT)',
        requestBody: body(ref('RegisterInput')),
        responses: {
          201: json(ref('Session'), 'Sesión creada'),
          400: common[400],
          409: errorResponse('Correo ya registrado'),
          429: errorResponse('Demasiados intentos'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Inicio de sesión',
        requestBody: body(ref('LoginInput')),
        responses: {
          200: json(ref('Session')),
          401: errorResponse('Credenciales inválidas'),
          429: errorResponse('Demasiados intentos'),
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rota el refresh token (cookie) y emite un access token nuevo',
        security: [{ refreshCookie: [] }],
        responses: { 200: json(ref('Session')), 401: errorResponse('Sesión inválida o expirada') },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Revoca el refresh token y borra la cookie',
        security: [{ refreshCookie: [] }],
        responses: { 204: { description: 'Sesión cerrada' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Usuario actual',
        security: auth,
        responses: {
          200: json({ type: 'object', properties: { user: ref('User') } }),
          401: common[401],
        },
      },
      patch: {
        tags: ['Auth'],
        summary: 'Editar nombre y teléfono',
        security: auth,
        requestBody: body({
          type: 'object',
          properties: { name: { type: 'string' }, phone: { type: ['string', 'null'] } },
        }),
        responses: {
          200: json({ type: 'object', properties: { user: ref('User') } }),
          400: common[400],
          401: common[401],
        },
      },
    },
    '/services': {
      get: {
        tags: ['Servicios'],
        summary: 'Listado (público: solo activos; admin con ?all=true: todos)',
        parameters: [{ name: 'all', in: 'query', schema: { type: 'string', enum: ['true'] } }],
        responses: {
          200: json({
            type: 'object',
            properties: { services: { type: 'array', items: ref('Service') } },
          }),
        },
      },
      post: {
        tags: ['Servicios'],
        summary: 'Crear servicio (admin)',
        security: auth,
        requestBody: body(ref('ServiceInput')),
        responses: {
          201: json({ type: 'object', properties: { service: ref('Service') } }),
          400: common[400],
          401: common[401],
          403: common[403],
        },
      },
    },
    '/services/{id}': {
      get: {
        tags: ['Servicios'],
        summary: 'Detalle',
        parameters: [idParam],
        responses: {
          200: json({ type: 'object', properties: { service: ref('Service') } }),
          404: common[404],
        },
      },
      patch: {
        tags: ['Servicios'],
        summary: 'Editar (admin)',
        security: auth,
        parameters: [idParam],
        requestBody: body(ref('ServiceInput')),
        responses: {
          200: json({ type: 'object', properties: { service: ref('Service') } }),
          400: common[400],
          403: common[403],
          404: common[404],
        },
      },
    },
    '/services/{id}/toggle': {
      patch: {
        tags: ['Servicios'],
        summary: 'Activar / desactivar (admin). No borra citas.',
        security: auth,
        parameters: [idParam],
        responses: {
          200: json({ type: 'object', properties: { service: ref('Service') } }),
          403: common[403],
          404: common[404],
        },
      },
    },
    '/staff': {
      get: {
        tags: ['Profesionales'],
        summary: 'Listado (público: activos; ?serviceId= filtra por servicio; admin ?all=true)',
        parameters: [
          { name: 'serviceId', in: 'query', schema: uuid },
          { name: 'all', in: 'query', schema: { type: 'string', enum: ['true'] } },
        ],
        responses: {
          200: json({
            type: 'object',
            properties: { staff: { type: 'array', items: ref('Staff') } },
          }),
        },
      },
      post: {
        tags: ['Profesionales'],
        summary: 'Crear (admin)',
        security: auth,
        requestBody: body(ref('StaffInput')),
        responses: {
          201: json({ type: 'object', properties: { staff: ref('Staff') } }),
          400: common[400],
          403: common[403],
        },
      },
    },
    '/staff/{id}': {
      get: {
        tags: ['Profesionales'],
        summary: 'Detalle',
        parameters: [idParam],
        responses: {
          200: json({ type: 'object', properties: { staff: ref('Staff') } }),
          404: common[404],
        },
      },
      patch: {
        tags: ['Profesionales'],
        summary: 'Editar, incluidos los servicios que ofrece (admin)',
        security: auth,
        parameters: [idParam],
        requestBody: body(ref('StaffInput')),
        responses: {
          200: json({ type: 'object', properties: { staff: ref('Staff') } }),
          400: common[400],
          403: common[403],
          404: common[404],
        },
      },
    },
    '/staff/{id}/toggle': {
      patch: {
        tags: ['Profesionales'],
        summary:
          'Activar / desactivar (admin). Al desactivar devuelve las citas futuras afectadas.',
        security: auth,
        parameters: [idParam],
        responses: {
          200: json({
            type: 'object',
            properties: {
              staff: ref('Staff'),
              affectedAppointments: { type: 'array', items: ref('AffectedAppointment') },
            },
          }),
          403: common[403],
          404: common[404],
        },
      },
    },
    '/staff/{id}/working-hours': {
      get: {
        tags: ['Profesionales'],
        summary: 'Horario semanal (admin)',
        security: auth,
        parameters: [idParam],
        responses: {
          200: json({
            type: 'object',
            properties: { workingHours: { type: 'array', items: ref('WorkingHours') } },
          }),
          403: common[403],
          404: common[404],
        },
      },
      put: {
        tags: ['Profesionales'],
        summary: 'Reemplaza todos los bloques (admin). Valida traslapes; devuelve citas afectadas.',
        security: auth,
        parameters: [idParam],
        requestBody: body({
          type: 'object',
          required: ['blocks'],
          properties: { blocks: { type: 'array', items: ref('WorkingHoursBlock') } },
        }),
        responses: {
          200: json({
            type: 'object',
            properties: {
              workingHours: { type: 'array', items: ref('WorkingHours') },
              affectedAppointments: { type: 'array', items: ref('AffectedAppointment') },
            },
          }),
          400: common[400],
          403: common[403],
          404: common[404],
        },
      },
    },
    '/staff/{id}/time-off': {
      get: {
        tags: ['Profesionales'],
        summary: 'Días libres (admin)',
        security: auth,
        parameters: [idParam],
        responses: {
          200: json({
            type: 'object',
            properties: { timeOff: { type: 'array', items: ref('TimeOff') } },
          }),
          403: common[403],
          404: common[404],
        },
      },
      post: {
        tags: ['Profesionales'],
        summary: 'Añadir día libre (admin). Devuelve citas afectadas.',
        security: auth,
        parameters: [idParam],
        requestBody: body(ref('TimeOffInput')),
        responses: {
          201: json({
            type: 'object',
            properties: {
              timeOff: ref('TimeOff'),
              affectedAppointments: { type: 'array', items: ref('AffectedAppointment') },
            },
          }),
          400: common[400],
          403: common[403],
          404: common[404],
        },
      },
    },
    '/time-off/{id}': {
      delete: {
        tags: ['Profesionales'],
        summary: 'Eliminar día libre (admin)',
        security: auth,
        parameters: [idParam],
        responses: { 204: { description: 'Eliminado' }, 403: common[403], 404: common[404] },
      },
    },
    '/availability': {
      get: {
        tags: ['Disponibilidad'],
        summary: 'Horarios de inicio disponibles de un día para un servicio',
        description:
          'Si no se indica staffId devuelve los horarios de todos los profesionales que ofrecen el servicio, indicando cuál. ' +
          'Aplica horario laboral, días libres, citas existentes, minAdvanceHours y maxAdvanceDays.',
        parameters: [
          { name: 'serviceId', in: 'query', required: true, schema: uuid },
          { name: 'staffId', in: 'query', schema: uuid },
          { name: 'date', in: 'query', required: true, schema: date },
        ],
        responses: { 200: json(ref('Availability')), 400: common[400], 404: common[404] },
      },
    },
    '/appointments': {
      post: {
        tags: ['Citas'],
        summary: 'Crear cita (cliente autenticado)',
        description:
          'Reglas: servicio y profesional activos, dentro del horario, sin traslape, anticipación mínima/máxima, ' +
          'máximo 5 citas futuras. Si dos peticiones compiten por el mismo horario, la restricción de exclusión de PostgreSQL deja pasar solo una (409).',
        security: auth,
        requestBody: body(ref('CreateAppointmentInput')),
        responses: {
          201: json({ type: 'object', properties: { appointment: ref('Appointment') } }),
          400: common[400],
          401: common[401],
          409: errorResponse('Horario ocupado'),
          422: common[422],
        },
      },
      get: {
        tags: ['Citas'],
        summary: 'Listado paginado con filtros (admin)',
        security: auth,
        parameters: [
          { name: 'from', in: 'query', schema: date },
          { name: 'to', in: 'query', schema: date },
          { name: 'staffId', in: 'query', schema: uuid },
          { name: 'status', in: 'query', schema: ref('AppointmentStatus') },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          200: json({
            type: 'object',
            properties: {
              data: { type: 'array', items: ref('Appointment') },
              page: { type: 'integer' },
              pageSize: { type: 'integer' },
              total: { type: 'integer' },
            },
          }),
          403: common[403],
        },
      },
    },
    '/appointments/mine': {
      get: {
        tags: ['Citas'],
        summary: 'Mis citas (próximas o historial)',
        security: auth,
        parameters: [
          {
            name: 'scope',
            in: 'query',
            schema: { type: 'string', enum: ['upcoming', 'past'], default: 'upcoming' },
          },
        ],
        responses: {
          200: json({
            type: 'object',
            properties: { appointments: { type: 'array', items: ref('Appointment') } },
          }),
          401: common[401],
        },
      },
    },
    '/appointments/{id}/cancel': {
      patch: {
        tags: ['Citas'],
        summary: 'Cancelar (dueño con cancellationHours de anticipación, o admin siempre)',
        security: auth,
        parameters: [idParam],
        responses: {
          200: json({ type: 'object', properties: { appointment: ref('Appointment') } }),
          404: common[404],
          422: common[422],
        },
      },
    },
    '/appointments/{id}/status': {
      patch: {
        tags: ['Citas'],
        summary: 'Marcar COMPLETED o NO_SHOW (admin, solo si la cita ya empezó)',
        security: auth,
        parameters: [idParam],
        requestBody: body({
          type: 'object',
          required: ['status'],
          properties: { status: { type: 'string', enum: ['COMPLETED', 'NO_SHOW'] } },
        }),
        responses: {
          200: json({ type: 'object', properties: { appointment: ref('Appointment') } }),
          400: common[400],
          403: common[403],
          404: common[404],
          422: common[422],
        },
      },
    },
    '/settings': {
      get: {
        tags: ['Configuración'],
        summary: 'Datos públicos del negocio',
        responses: { 200: json({ type: 'object', properties: { settings: ref('Settings') } }) },
      },
      patch: {
        tags: ['Configuración'],
        summary: 'Editar (admin)',
        security: auth,
        requestBody: body(ref('Settings')),
        responses: {
          200: json({ type: 'object', properties: { settings: ref('Settings') } }),
          400: common[400],
          403: common[403],
          422: errorResponse('Intervalo incompatible con servicios activos'),
        },
      },
    },
    '/stats/overview': {
      get: {
        tags: ['Estadísticas'],
        summary: 'Resumen de un rango de fechas (admin)',
        security: auth,
        parameters: [
          { name: 'from', in: 'query', required: true, schema: date },
          { name: 'to', in: 'query', required: true, schema: date },
        ],
        responses: { 200: json(ref('StatsOverview')), 400: common[400], 403: common[403] },
      },
    },
  },
};
