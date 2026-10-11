import { useState } from 'react';
import { toDateString } from '@/lib/format';
import { Button } from './Button';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface CalendarProps {
  value: string | null;
  onChange: (date: string) => void;
  /** Primer día seleccionable (YYYY-MM-DD) */
  minDate: string;
  /** Último día seleccionable (YYYY-MM-DD) */
  maxDate: string;
}

/** Calendario mensual simple; deshabilita días fuera de [minDate, maxDate]. */
export function Calendar({ value, onChange, minDate, maxDate }: CalendarProps) {
  const initial = value ? new Date(`${value}T00:00:00`) : new Date(`${minDate}T00:00:00`);
  const [cursor, setCursor] = useState({ year: initial.getFullYear(), month: initial.getMonth() });

  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  // Lunes = 0 ... Domingo = 6
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

  const prevMonth = () =>
    setCursor((c) =>
      c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 },
    );
  const nextMonth = () =>
    setCursor((c) =>
      c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 },
    );

  const monthStart = toDateString(firstOfMonth);
  const monthEnd = toDateString(new Date(cursor.year, cursor.month, daysInMonth));
  const canGoPrev = monthStart > minDate;
  const canGoNext = monthEnd < maxDate;

  return (
    <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={prevMonth}
          disabled={!canGoPrev}
          aria-label="Mes anterior"
        >
          ‹
        </Button>
        <p className="font-medium text-slate-900 capitalize" aria-live="polite">
          {MONTHS[cursor.month]} {cursor.year}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={nextMonth}
          disabled={!canGoNext}
          aria-label="Mes siguiente"
        >
          ›
        </Button>
      </div>
      <div
        role="grid"
        aria-label="Calendario"
        className="grid grid-cols-7 gap-1 text-center text-sm"
      >
        {WEEKDAYS.map((day, i) => (
          <div key={i} role="columnheader" className="py-1 text-xs font-medium text-slate-500">
            {day}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateString = toDateString(new Date(cursor.year, cursor.month, day));
          const disabled = dateString < minDate || dateString > maxDate;
          const selected = dateString === value;
          return (
            <button
              key={dateString}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-label={dateString}
              disabled={disabled}
              onClick={() => onChange(dateString)}
              className={`rounded-md py-2 transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 ${
                selected
                  ? 'bg-brand-600 font-semibold text-white'
                  : disabled
                    ? 'text-slate-300'
                    : 'text-slate-800 hover:bg-brand-50'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
