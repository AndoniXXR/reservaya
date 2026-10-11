import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Mail } from '../../config/mailer.ts';

export interface AppointmentMailData {
  clientName: string;
  clientEmail: string;
  serviceName: string;
  staffName: string;
  startsAt: Date;
  priceAtBooking: number;
}

export interface BusinessMailData {
  businessName: string;
  address: string | null;
  contactPhone: string | null;
  timezone: string;
  appUrl: string;
}

/** "martes 3 de noviembre, 09:00" en la zona del negocio */
export function formatAppointmentDate(date: Date, timezone: string): string {
  return format(new TZDate(date, timezone), "EEEE d 'de' MMMM, HH:mm", { locale: es });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function layout(business: BusinessMailData, title: string, body: string): string {
  const footer = [business.address, business.contactPhone]
    .filter((value): value is string => Boolean(value))
    .map(escapeHtml);
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f8fafc;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">
    <div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:#1f58c4;color:#fff;padding:20px 24px;font-size:20px;font-weight:700">${escapeHtml(business.businessName)}</div>
      <div style="padding:24px">
        <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
        ${body}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">
        ${footer.join(' · ')}
      </div>
    </div>
  </body>
</html>`;
}

function detailsTable(appointment: AppointmentMailData, business: BusinessMailData): string {
  const rows: [string, string][] = [
    ['Servicio', appointment.serviceName],
    ['Profesional', appointment.staffName],
    ['Fecha y hora', formatAppointmentDate(appointment.startsAt, business.timezone)],
    ['Precio', `Q ${appointment.priceAtBooking.toFixed(2)}`],
  ];
  if (business.address) rows.push(['Dirección', business.address]);
  return `<table style="border-collapse:collapse;width:100%;margin:16px 0">
    ${rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:6px 0;color:#64748b;width:120px">${label}</td><td style="padding:6px 0;font-weight:600">${escapeHtml(value)}</td></tr>`,
      )
      .join('')}
  </table>`;
}

function detailsText(appointment: AppointmentMailData, business: BusinessMailData): string {
  return [
    `Servicio: ${appointment.serviceName}`,
    `Profesional: ${appointment.staffName}`,
    `Fecha y hora: ${formatAppointmentDate(appointment.startsAt, business.timezone)}`,
    `Precio: Q ${appointment.priceAtBooking.toFixed(2)}`,
    business.address ? `Dirección: ${business.address}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

const link = (business: BusinessMailData) =>
  `<p><a href="${business.appUrl}/mis-citas" style="color:#1f58c4">Ver mis citas</a></p>`;

export function confirmationMail(
  appointment: AppointmentMailData,
  business: BusinessMailData,
): Mail {
  const greeting = `Hola ${escapeHtml(appointment.clientName)}, tu cita quedó confirmada.`;
  return {
    to: appointment.clientEmail,
    subject: `Cita confirmada: ${appointment.serviceName} · ${business.businessName}`,
    text: `Hola ${appointment.clientName}, tu cita quedó confirmada.\n\n${detailsText(appointment, business)}\n\nPuedes ver o cancelar tus citas en ${business.appUrl}/mis-citas`,
    html: layout(
      business,
      'Cita confirmada',
      `<p>${greeting}</p>${detailsTable(appointment, business)}${link(business)}`,
    ),
  };
}

export function cancellationMail(
  appointment: AppointmentMailData,
  business: BusinessMailData,
  cancelledBy: 'CLIENT' | 'ADMIN',
): Mail {
  const who =
    cancelledBy === 'ADMIN'
      ? `${business.businessName} ha cancelado tu cita. Lamentamos las molestias; puedes reservar otro horario cuando quieras.`
      : 'Tu cita ha sido cancelada como solicitaste.';
  return {
    to: appointment.clientEmail,
    subject: `Cita cancelada: ${appointment.serviceName} · ${business.businessName}`,
    text: `Hola ${appointment.clientName}. ${who}\n\n${detailsText(appointment, business)}\n\nReserva de nuevo en ${business.appUrl}/reservar`,
    html: layout(
      business,
      'Cita cancelada',
      `<p>Hola ${escapeHtml(appointment.clientName)}. ${escapeHtml(who)}</p>${detailsTable(appointment, business)}<p><a href="${business.appUrl}/reservar" style="color:#1f58c4">Reservar de nuevo</a></p>`,
    ),
  };
}

export function reminderMail(appointment: AppointmentMailData, business: BusinessMailData): Mail {
  return {
    to: appointment.clientEmail,
    subject: `Recordatorio: mañana tienes cita en ${business.businessName}`,
    text: `Hola ${appointment.clientName}, te recordamos tu cita de mañana.\n\n${detailsText(appointment, business)}\n\nSi no puedes asistir, cancela en ${business.appUrl}/mis-citas`,
    html: layout(
      business,
      'Tu cita es mañana',
      `<p>Hola ${escapeHtml(appointment.clientName)}, te recordamos tu cita de mañana.</p>${detailsTable(appointment, business)}<p>Si no puedes asistir, por favor cancela con anticipación.</p>${link(business)}`,
    ),
  };
}
