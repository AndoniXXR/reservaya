import nodemailer from 'nodemailer';
import { env, isTest } from './env.ts';
import { logger } from './logger.ts';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** En pruebas no se envía nada: los correos se acumulan aquí para poder comprobarlos. */
export const outbox: Mail[] = [];

const transporter = isTest
  ? null
  : nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER && { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? '' } }),
      // Un SMTP caído debe fallar (y quedar en el log), no dejar promesas colgadas
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });

export async function sendMail(mail: Mail): Promise<void> {
  if (!transporter) {
    outbox.push(mail);
    return;
  }
  const info = await transporter.sendMail({ from: env.MAIL_FROM, ...mail });
  logger.info({ to: mail.to, subject: mail.subject, messageId: info.messageId }, 'Correo enviado');
}
