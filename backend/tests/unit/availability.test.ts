import { describe, expect, it } from 'vitest';
import {
  computeAvailability,
  localDateTime,
  type AvailabilityInput,
  type StaffAvailabilityData,
} from '../../src/modules/availability/availability.core.ts';

const TZ = 'America/Guatemala';
// Martes 3 de noviembre de 2026
const DATE = '2026-11-03';
const at = (time: string, date = DATE) => localDateTime(date, time, TZ);

function staff(overrides: Partial<StaffAvailabilityData> = {}): StaffAvailabilityData {
  return {
    id: 's1',
    name: 'Carlos',
    workingHours: [{ dayOfWeek: 2, startTime: '09:00', endTime: '12:00' }],
    timeOff: [],
    appointments: [],
    ...overrides,
  };
}

function input(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    date: DATE,
    timezone: TZ,
    // "Ahora" es un mes antes, para que las reglas de anticipación no interfieran
    now: new Date('2026-10-20T12:00:00.000Z'),
    durationMinutes: 30,
    slotIntervalMinutes: 15,
    minAdvanceHours: 2,
    maxAdvanceDays: 30,
    staff: [staff()],
    ...overrides,
  };
}

const labels = (slots: ReturnType<typeof computeAvailability>) => slots.map((s) => s.label);

describe('computeAvailability', () => {
  it('día sin horario laboral → sin slots', () => {
    const result = computeAvailability(
      input({
        staff: [staff({ workingHours: [{ dayOfWeek: 0, startTime: '09:00', endTime: '12:00' }] })],
      }),
    );
    expect(result).toEqual([]);
  });

  it('bloque 09:00-12:00, servicio de 30 min, intervalo 15 → último slot 11:30', () => {
    const result = computeAvailability(input());
    expect(labels(result)[0]).toBe('09:00');
    expect(labels(result).at(-1)).toBe('11:30');
    expect(result).toHaveLength(11);
    expect(labels(result)).not.toContain('11:45');
  });

  it('dos bloques con almuerzo → ningún slot cruza el almuerzo', () => {
    const result = computeAvailability(
      input({
        durationMinutes: 45,
        staff: [
          staff({
            workingHours: [
              { dayOfWeek: 2, startTime: '09:00', endTime: '13:00' },
              { dayOfWeek: 2, startTime: '14:00', endTime: '18:00' },
            ],
          }),
        ],
      }),
    );
    const found = labels(result);
    expect(found).toContain('12:15');
    expect(found).not.toContain('12:30');
    expect(found).not.toContain('12:45');
    expect(found).not.toContain('13:00');
    expect(found).not.toContain('13:45');
    expect(found).toContain('14:00');
    expect(found.at(-1)).toBe('17:15');
  });

  it('cita 10:00-10:45 bloquea 09:45, 10:00, 10:15 y 10:30 pero no 10:45', () => {
    const result = computeAvailability(
      input({
        staff: [
          staff({
            appointments: [{ startsAt: at('10:00'), endsAt: at('10:45'), status: 'CONFIRMED' }],
          }),
        ],
      }),
    );
    const found = labels(result);
    expect(found).toContain('09:30');
    expect(found).not.toContain('09:45');
    expect(found).not.toContain('10:00');
    expect(found).not.toContain('10:15');
    expect(found).not.toContain('10:30');
    expect(found).toContain('10:45');
  });

  it('las citas canceladas no bloquean horarios', () => {
    const result = computeAvailability(
      input({
        staff: [
          staff({
            appointments: [{ startsAt: at('10:00'), endsAt: at('10:45'), status: 'CANCELLED' }],
          }),
        ],
      }),
    );
    expect(labels(result)).toContain('10:00');
    expect(labels(result)).toContain('10:15');
  });

  it('un día libre que cubre parte del día quita solo esas horas', () => {
    const result = computeAvailability(
      input({ staff: [staff({ timeOff: [{ startsAt: at('09:00'), endsAt: at('10:30') }] })] }),
    );
    const found = labels(result);
    expect(found[0]).toBe('10:30');
    expect(found).not.toContain('10:15');
  });

  it('respeta minAdvanceHours cuando la fecha es hoy', () => {
    // Son las 09:10 hora local; con 2 h de anticipación el primer slot es 11:15
    const result = computeAvailability(input({ now: at('09:10') }));
    expect(labels(result)[0]).toBe('11:15');
  });

  it('fecha fuera de maxAdvanceDays → sin slots', () => {
    const result = computeAvailability(
      input({ now: new Date('2026-09-01T12:00:00.000Z'), maxAdvanceDays: 30 }),
    );
    expect(result).toEqual([]);
  });

  it('convierte correctamente la zona horaria (Guatemala, UTC-6)', () => {
    const result = computeAvailability(input());
    expect(result[0]).toMatchObject({ label: '09:00', startsAt: '2026-11-03T15:00:00.000Z' });
  });

  it('devuelve los slots de todos los profesionales indicando cuál', () => {
    const result = computeAvailability(
      input({
        staff: [
          staff(),
          staff({
            id: 's2',
            name: 'Ana',
            workingHours: [{ dayOfWeek: 2, startTime: '11:00', endTime: '12:00' }],
          }),
        ],
      }),
    );
    const at11 = result.filter((s) => s.label === '11:00');
    expect(at11.map((s) => s.staffName)).toEqual(['Ana', 'Carlos']);
    expect(result.filter((s) => s.staffId === 's2')).toHaveLength(3);
  });

  it('un servicio que no cabe en el bloque no genera slots', () => {
    const result = computeAvailability(input({ durationMinutes: 240 }));
    expect(result).toEqual([]);
  });
});
