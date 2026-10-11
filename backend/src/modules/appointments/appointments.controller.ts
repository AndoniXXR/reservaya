import type { RequestHandler } from 'express';
import type {
  AdminListQuery,
  CreateAppointmentInput,
  UpdateStatusInput,
} from './appointments.schemas.ts';
import * as appointmentsService from './appointments.service.ts';

export const create: RequestHandler = async (req, res) => {
  const appointment = await appointmentsService.createAppointment(
    req.user!.id,
    res.locals.body as CreateAppointmentInput,
  );
  res.status(201).json({ appointment });
};

export const mine: RequestHandler = async (req, res) => {
  const { scope } = res.locals.query as { scope: 'upcoming' | 'past' };
  res.json({ appointments: await appointmentsService.listMine(req.user!.id, scope) });
};

export const cancel: RequestHandler = async (req, res) => {
  const { id } = res.locals.params as { id: string };
  res.json({ appointment: await appointmentsService.cancelAppointment(id, req.user!) });
};

export const list: RequestHandler = async (_req, res) => {
  res.json(await appointmentsService.listForAdmin(res.locals.query as AdminListQuery));
};

export const updateStatus: RequestHandler = async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const appointment = await appointmentsService.updateStatus(
    id,
    res.locals.body as UpdateStatusInput,
  );
  res.json({ appointment });
};
