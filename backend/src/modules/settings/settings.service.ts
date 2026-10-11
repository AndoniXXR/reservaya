import { env } from '../../config/env.ts';
import { prisma } from '../../config/prisma.ts';
import type { BusinessSettings } from '../../generated/prisma/client.ts';
import { AppError } from '../../utils/errors.ts';
import type { UpdateSettingsInput } from './settings.schemas.ts';

/** La fila única se crea con valores por defecto si el seed no se ha ejecutado. */
export async function getSettings(): Promise<BusinessSettings> {
  return prisma.businessSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export async function updateSettings(input: UpdateSettingsInput): Promise<BusinessSettings> {
  if (env.DEMO_MODE && input.businessName !== undefined) {
    throw AppError.forbidden('En la demo pública no se puede cambiar el nombre del negocio');
  }

  if (input.slotIntervalMinutes !== undefined) {
    const incompatible = await prisma.service.findMany({
      where: {
        active: true,
        NOT: { durationMinutes: { in: multiplesUpTo(input.slotIntervalMinutes, 240) } },
      },
      select: { name: true },
    });
    if (incompatible.length > 0) {
      throw AppError.businessRule(
        `Hay servicios activos cuya duración no es múltiplo de ${input.slotIntervalMinutes} minutos: ${incompatible.map((s) => s.name).join(', ')}`,
      );
    }
  }

  await getSettings();
  return prisma.businessSettings.update({ where: { id: 1 }, data: input });
}

function multiplesUpTo(step: number, max: number): number[] {
  const result: number[] = [];
  for (let value = step; value <= max; value += step) result.push(value);
  return result;
}
