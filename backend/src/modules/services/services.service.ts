import { prisma } from '../../config/prisma.ts';
import type { Service } from '../../generated/prisma/client.ts';
import { AppError } from '../../utils/errors.ts';
import { decimalToNumber } from '../../utils/serializers.ts';
import { getSettings } from '../settings/settings.service.ts';
import type { CreateServiceInput, UpdateServiceInput } from './services.schemas.ts';

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  active: boolean;
}

export function toPublicService(service: Service): PublicService {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    price: decimalToNumber(service.price),
    active: service.active,
  };
}

async function assertDurationFitsSlot(durationMinutes: number) {
  const { slotIntervalMinutes } = await getSettings();
  if (durationMinutes % slotIntervalMinutes !== 0) {
    throw AppError.validation('Datos inválidos', {
      durationMinutes: `La duración debe ser múltiplo de ${slotIntervalMinutes} minutos`,
    });
  }
}

export async function listServices(includeInactive: boolean): Promise<PublicService[]> {
  const services = await prisma.service.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });
  return services.map(toPublicService);
}

export async function getService(id: string): Promise<PublicService> {
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) throw AppError.notFound('El servicio no existe');
  return toPublicService(service);
}

export async function createService(input: CreateServiceInput): Promise<PublicService> {
  await assertDurationFitsSlot(input.durationMinutes);
  const service = await prisma.service.create({
    data: { ...input, description: input.description ?? null },
  });
  return toPublicService(service);
}

export async function updateService(id: string, input: UpdateServiceInput): Promise<PublicService> {
  await getService(id);
  if (input.durationMinutes !== undefined) await assertDurationFitsSlot(input.durationMinutes);
  const service = await prisma.service.update({ where: { id }, data: input });
  return toPublicService(service);
}

/** Activar/desactivar. Desactivar no borra citas; solo impide nuevas reservas. */
export async function toggleService(id: string): Promise<PublicService> {
  const current = await prisma.service.findUnique({ where: { id } });
  if (!current) throw AppError.notFound('El servicio no existe');
  const service = await prisma.service.update({
    where: { id },
    data: { active: !current.active },
  });
  return toPublicService(service);
}
