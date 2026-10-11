import type { Decimal } from '../generated/prisma/internal/prismaNamespace.ts';

/** Prisma devuelve Decimal; la API expone números con dos decimales. */
export const decimalToNumber = (value: Decimal | number | string): number =>
  Number(Number(value).toFixed(2));
