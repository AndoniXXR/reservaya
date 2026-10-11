import { env } from '../../config/env.ts';
import { logger } from '../../config/logger.ts';
import { sendMail } from '../../config/mailer.ts';
import type { PublicAppointment } from '../appointments/appointments.service.ts';
import { getSettings } from '../settings/settings.service.ts';
import {
  cancellationMail,
  confirmationMail,
  reminderMail,
  type AppointmentMailData,
  type BusinessMailData,
} from './templates.ts';

async function businessData(): Promise<BusinessMailData> {
  const settings = await getSettings();
  return {
    businessName: settings.businessName,
    address: settings.address,
    contactPhone: settings.contactPhone,
    timezone: settings.timezone,
    appUrl: env.APP_URL,
  };
}

function appointmentData(appointment: PublicAppointment): AppointmentMailData {
  return {
    clientName: appointment.client.name,
    clientEmail: appointment.client.email,
    serviceName: appointment.service.name,
    staffName: appointment.staff.name,
    startsAt: appointment.startsAt,
    priceAtBooking: appointment.priceAtBooking,
  };
}

export async function sendConfirmation(appointment: PublicAppointment): Promise<void> {
  await sendMail(confirmationMail(appointmentData(appointment), await businessData()));
}

export async function sendCancellation(
  appointment: PublicAppointment,
  cancelledBy: 'CLIENT' | 'ADMIN',
): Promise<void> {
  await sendMail(cancellationMail(appointmentData(appointment), await businessData(), cancelledBy));
}

export async function sendReminder(appointment: PublicAppointment): Promise<void> {
  await sendMail(reminderMail(appointmentData(appointment), await businessData()));
}

/**
 * Envía sin bloquear la respuesta HTTP: la promesa se lanza y cualquier fallo
 * queda registrado en el log en lugar de propagarse al cliente.
 */
export function notifyInBackground(task: () => Promise<void>, context: Record<string, unknown>) {
  task().catch((err: unknown) => {
    logger.error({ err, ...context }, 'No se pudo enviar el correo');
  });
}
