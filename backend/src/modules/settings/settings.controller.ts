import type { RequestHandler } from 'express';
import type { BusinessSettings } from '../../generated/prisma/client.ts';
import type { UpdateSettingsInput } from './settings.schemas.ts';
import * as settingsService from './settings.service.ts';

// Datos públicos del negocio (sin id interno)
function toPublic(settings: BusinessSettings) {
  const { id: _id, ...rest } = settings;
  return rest;
}

export const getSettings: RequestHandler = async (_req, res) => {
  res.json({ settings: toPublic(await settingsService.getSettings()) });
};

export const updateSettings: RequestHandler = async (_req, res) => {
  const settings = await settingsService.updateSettings(res.locals.body as UpdateSettingsInput);
  res.json({ settings: toPublic(settings) });
};
