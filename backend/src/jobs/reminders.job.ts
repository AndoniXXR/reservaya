import cron from 'node-cron';
import { addHours } from 'date-fns';
import { logger } from '../config/logger.ts';
import { prisma } from '../config/prisma.ts';
import { toPublicAppointment } from '../modules/appointments/appointments.service.ts';
import { sendReminder } from '../modules/notifications/notifications.service.ts';

const include = {
  service: { select: { id: true, name: true, durationMinutes: true } },
  staff: { select: { id: true, name: true } },
  client: { select: { id: true, name: true, email: true, phone: true } },
} as const;

/**
 * Envía recordatorios de las citas confirmadas que empiezan entre 23 y 25 horas después
 * de `now`. Cada cita se "reclama" con un UPDATE condicional antes de enviar, así dos
 * pasadas concurrentes nunca mandan dos recordatorios. Devuelve cuántos se enviaron.
 */
export async function runReminderPass(now = new Date()): Promise<number> {
  const candidates = await prisma.appointment.findMany({
    where: {
      status: 'CONFIRMED',
      reminderSentAt: null,
      startsAt: { gte: addHours(now, 23), lte: addHours(now, 25) },
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

/** Cada 10 minutos. */
export function startReminderJob() {
  cron.schedule('*/10 * * * *', () => {
    runReminderPass().catch((err: unknown) => {
      logger.error({ err }, 'El job de recordatorios falló');
    });
  });
  logger.info('Job de recordatorios programado (cada 10 minutos)');
}
