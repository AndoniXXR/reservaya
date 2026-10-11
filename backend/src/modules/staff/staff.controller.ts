import type { RequestHandler } from 'express';
import type {
  CreateStaffInput,
  CreateTimeOffInput,
  PutWorkingHoursInput,
  UpdateStaffInput,
} from './staff.schemas.ts';
import * as staffService from './staff.service.ts';

type IdParams = { id: string };

export const list: RequestHandler = async (req, res) => {
  const { serviceId, all } = res.locals.query as { serviceId?: string; all: boolean };
  const includeInactive = all && req.user?.role === 'ADMIN';
  res.json({ staff: await staffService.listStaff({ serviceId, includeInactive }) });
};

export const get: RequestHandler = async (_req, res) => {
  const { id } = res.locals.params as IdParams;
  res.json({ staff: await staffService.getStaff(id) });
};

export const create: RequestHandler = async (_req, res) => {
  const staff = await staffService.createStaff(res.locals.body as CreateStaffInput);
  res.status(201).json({ staff });
};

export const update: RequestHandler = async (_req, res) => {
  const { id } = res.locals.params as IdParams;
  const staff = await staffService.updateStaff(id, res.locals.body as UpdateStaffInput);
  res.json({ staff });
};

export const toggle: RequestHandler = async (_req, res) => {
  const { id } = res.locals.params as IdParams;
  res.json(await staffService.toggleStaff(id));
};

export const getWorkingHours: RequestHandler = async (_req, res) => {
  const { id } = res.locals.params as IdParams;
  res.json({ workingHours: await staffService.getWorkingHours(id) });
};

export const putWorkingHours: RequestHandler = async (_req, res) => {
  const { id } = res.locals.params as IdParams;
  res.json(await staffService.replaceWorkingHours(id, res.locals.body as PutWorkingHoursInput));
};

export const listTimeOff: RequestHandler = async (_req, res) => {
  const { id } = res.locals.params as IdParams;
  res.json({ timeOff: await staffService.listTimeOff(id) });
};

export const createTimeOff: RequestHandler = async (_req, res) => {
  const { id } = res.locals.params as IdParams;
  const result = await staffService.createTimeOff(id, res.locals.body as CreateTimeOffInput);
  res.status(201).json(result);
};

export const deleteTimeOff: RequestHandler = async (_req, res) => {
  const { id } = res.locals.params as IdParams;
  await staffService.deleteTimeOff(id);
  res.status(204).end();
};
