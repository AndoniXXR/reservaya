import cron from 'node-cron';
import { addDays, addHours } from 'date-fns';
import { logger } from '../config/logger.ts';
import { prisma } from '../config/prisma.ts';
import { toPublicAppointment } from '../modules/appointments/appointments.service.ts';
import { localDateTime } from '../modules/availability/availability.core.ts';
import { sendReminder } from '../modules/notifications/notifications.service.ts';
import { getSettings } from '../modules/settings/settings.service.ts';

const include = {
  service: { select: { id: true, name: true, durationMinutes: true } },
  staff: { select: { id: true, name: true } },
  client: { select: { id: true, name: true, email: true, phone: true } },
} as const;

export interface ReminderWindow {
  start: Date;
  end: Date;
}

/** Ventana del job continuo (cada 10 min): citas que empiezan dentro de 23–25 h. */
export function rollingWindow(now: Date): ReminderWindow {
  return { start: addHours(now, 23), end: addHours(now, 25) };
}

/** Ventana del job diario (una pasada por la mañana): todas las citas de mañana, en hora local. */
export async function tomorrowWindow(now: Date): Promise<ReminderWindow> {
  const { timezone } = await getSettings();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
  const start = addDays(localDateTime(today, '00:00', timezone), 1);
  return { start, end: addDays(start, 1) };
}

/**
 * Envía recordatorios de las citas confirmadas cuyo inicio cae en la ventana. Cada cita se
 * "reclama" con un UPDATE condicional antes de enviar, así dos pasadas concurrentes nunca
 * mandan dos recordatorios. Devuelve cuántos se enviaron.
 */
export async function runReminderPass(
  now = new Date(),
  window: ReminderWindow = rollingWindow(now),
): Promise<number> {
  const candidates = await prisma.appointment.findMany({
    where: {
      status: 'CONFIRMED',
      reminderSentAt: null,
      startsAt: { gte: window.start, lt: window.end },
    },
    include,
  });

  let sent = 0;
  for (const appointment of candidates) {
    const claimed = await prisma.appointment.updateMany({
      where: { id: appointment.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count === 0) continue;

    try {
      await sendReminder(toPublicAppointment(appointment));
      sent += 1;
    } catch (err) {
      logger.error({ err, appointmentId: appointment.id }, 'Falló el recordatorio; se reintentará');
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { reminderSentAt: null },
      });
    }
  }

  if (sent > 0) logger.info({ sent }, 'Recordatorios enviados');
  return sent;
}

/** Servidor persistente (Docker): cada 10 minutos. */
export function startReminderJob() {
  cron.schedule('*/10 * * * *', () => {
    runReminderPass().catch((err: unknown) => {
      logger.error({ err }, 'El job de recordatorios falló');
    });
  });
  logger.info('Job de recordatorios programado (cada 10 minutos)');
}
