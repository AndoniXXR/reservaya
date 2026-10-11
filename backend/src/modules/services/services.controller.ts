import type { RequestHandler } from 'express';
import type { CreateServiceInput, UpdateServiceInput } from './services.schemas.ts';
import * as servicesService from './services.service.ts';

export const list: RequestHandler = async (req, res) => {
  const { all } = res.locals.query as { all: boolean };
  // Solo el admin puede ver los inactivos
  const includeInactive = all && req.user?.role === 'ADMIN';
  res.json({ services: await servicesService.listServices(includeInactive) });
};

export const get: RequestHandler = async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  res.json({ service: await servicesService.getService(id) });
};

export const create: RequestHandler = async (_req, res) => {
  const service = await servicesService.createService(res.locals.body as CreateServiceInput);
  res.status(201).json({ service });
};

export const update: RequestHandler = async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const service = await servicesService.updateService(id, res.locals.body as UpdateServiceInput);
  res.json({ service });
};

export const toggle: RequestHandler = async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  res.json({ service: await servicesService.toggleService(id) });
};
