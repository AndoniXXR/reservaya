import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchAppointments, type Appointment } from '@/api/appointments';
import { fetchStaff } from '@/api/staff';
import { AppointmentDetailModal } from '@/features/appointments/AppointmentDetailModal';
import { STATUS_LABELS } from '@/features/appointments/status';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useSettings } from '@/hooks/useSettings';
import { formatDate, formatTime, toDateString } from '@/lib/format';

const HOUR_HEIGHT = 56; // px por hora
const START_HOUR = 7;
const END_HOUR = 21;

// Colores de fondo por estado, siempre con la etiqueta de texto al lado (nunca solo color)
const STATUS_STYLES: Record<Appointment['status'], string> = {
  CONFIRMED: 'border-sky-300 bg-sky-50 text-sky-900',
  COMPLETED: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  NO_SHOW: 'border-red-300 bg-red-50 text-red-900',
  CANCELLED: 'border-slate-300 bg-slate-50 text-slate-500 line-through',
};

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

export function AgendaPage() {
  const [date, setDate] = useState(() => toDateString(new Date()));
  const [selected, setSelected] = useState<Appointment | null>(null);
  const settings = useSettings();
  const timezone = settings.data?.timezone;

  const staff = useQuery({ queryKey: ['staff', 'all'], queryFn: () => fetchStaff({ all: true }) });
  const appointments = useQuery({
    queryKey: ['appointments', 'agenda', date],
    queryFn: () => fetchAppointments({ from: date, to: date, pageSize: 100 }),
  });

  const activeStaff = staff.data?.filter((s) => s.active) ?? [];
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  const localMinutes = (iso: string) => {
    const [h, m] = formatTime(iso, timezone).split(':').map(Number) as [number, number];
    return h * 60 + m;
  };

  return (
    <div>
      <PageHeader
        title="Agenda"
        description={formatDate(`${date}T12:00:00`, undefined)}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDate(shiftDate(date, -1))}
              aria-label="Día anterior"
            >
              ‹
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDate(toDateString(new Date()))}>
              Hoy
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDate(shiftDate(date, 1))}
              aria-label="Día siguiente"
            >
              ›
            </Button>
            <Input
              label="Fecha"
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </div>
        }
      />

      {(staff.isPending || appointments.isPending) && <TableSkeleton rows={6} />}
      {staff.isError && <ErrorMessage error={staff.error} onRetry={() => staff.refetch()} />}
      {appointments.isError && (
        <ErrorMessage error={appointments.error} onRetry={() => appointments.refetch()} />
      )}

      {staff.data && appointments.data && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <div
            className="grid min-w-[640px]"
            style={{
              gridTemplateColumns: `56px repeat(${Math.max(activeStaff.length, 1)}, minmax(160px, 1fr))`,
            }}
          >
            <div className="sticky top-0 border-b border-slate-200 bg-slate-50" />
            {activeStaff.map((member) => (
              <div
                key={member.id}
                className="border-b border-l border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800"
              >
                {member.name}
              </div>
            ))}

            <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-xs text-slate-400"
                  style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {activeStaff.map((member) => {
              const items = appointments.data.data.filter((a) => a.staff.id === member.id);
              return (
                <div
                  key={member.id}
                  className="relative border-l border-slate-200"
                  style={{ height: hours.length * HOUR_HEIGHT }}
                >
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      aria-hidden="true"
                      className="absolute inset-x-0 border-t border-slate-100"
                      style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                    />
                  ))}
                  {items.map((appointment) => {
                    const start = localMinutes(appointment.startsAt);
                    const end = localMinutes(appointment.endsAt);
                    const top = ((start - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                    const height = Math.max(((end - start) / 60) * HOUR_HEIGHT, 22);
                    return (
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={() => setSelected(appointment)}
                        className={`absolute inset-x-1 overflow-hidden rounded-md border px-2 py-1 text-left text-xs leading-tight transition hover:shadow focus-visible:outline-2 focus-visible:outline-brand-600 ${STATUS_STYLES[appointment.status]}`}
                        style={{ top, height }}
                        aria-label={`${formatTime(appointment.startsAt, timezone)} ${appointment.client.name}, ${appointment.service.name}, ${STATUS_LABELS[appointment.status]}`}
                      >
                        <span className="font-semibold">
                          {formatTime(appointment.startsAt, timezone)} {appointment.client.name}
                        </span>
                        <span className="block truncate">{appointment.service.name}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeStaff.length === 0 && staff.data && (
        <p className="mt-4 text-sm text-slate-500">No hay profesionales activos.</p>
      )}

      <AppointmentDetailModal
        appointment={selected}
        timezone={timezone}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
