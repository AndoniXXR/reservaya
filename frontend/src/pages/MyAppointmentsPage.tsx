import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { cancelAppointment, fetchMyAppointments, type Appointment } from '@/api/appointments';
import { getApiErrorMessage } from '@/api/errors';
import { AppointmentStatusBadge } from '@/features/appointments/AppointmentStatusBadge';
import { useToast } from '@/components/toast/useToast';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useSettings } from '@/hooks/useSettings';
import { formatDateTime, formatPrice } from '@/lib/format';

type Scope = 'upcoming' | 'past';

export function MyAppointmentsPage() {
  const [scope, setScope] = useState<Scope>('upcoming');
  const settings = useSettings();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [toCancel, setToCancel] = useState<Appointment | null>(null);

  const appointments = useQuery({
    queryKey: ['appointments', 'mine', scope],
    queryFn: () => fetchMyAppointments(scope),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelAppointment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      setToCancel(null);
      toast('Cita cancelada', 'success');
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  const cancellationHours = settings.data?.cancellationHours ?? 12;
  const timezone = settings.data?.timezone;

  // "Ahora" se fija al montar: el render debe ser puro y un minuto de desfase no importa aquí
  const [now] = useState(() => Date.now());
  const canCancel = (appointment: Appointment) =>
    new Date(appointment.startsAt).getTime() - now >= cancellationHours * 60 * 60 * 1000;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Mis citas"
        actions={
          <Link
            to="/reservar"
            className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Nueva reserva
          </Link>
        }
      />

      <div role="tablist" aria-label="Citas" className="mb-6 flex gap-1 border-b border-slate-200">
        {(['upcoming', 'past'] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={scope === value}
            onClick={() => setScope(value)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              scope === value
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {value === 'upcoming' ? 'Próximas' : 'Historial'}
          </button>
        ))}
      </div>

      {appointments.isPending && <TableSkeleton rows={3} />}
      {appointments.isError && (
        <ErrorMessage error={appointments.error} onRetry={() => appointments.refetch()} />
      )}
      {appointments.data && appointments.data.length === 0 && (
        <EmptyState
          title={scope === 'upcoming' ? 'No tienes citas próximas' : 'Aún no tienes historial'}
          description={scope === 'upcoming' ? 'Reserva tu siguiente cita en un minuto.' : undefined}
          action={
            scope === 'upcoming' ? (
              <Link to="/reservar" className="font-medium text-brand-600 hover:underline">
                Reservar ahora
              </Link>
            ) : undefined
          }
        />
      )}
      {appointments.data && appointments.data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {appointments.data.map((appointment) => {
            const cancellable = scope === 'upcoming' && canCancel(appointment);
            return (
              <li
                key={appointment.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {formatDateTime(appointment.startsAt, timezone)}
                  </p>
                  <p className="text-sm text-slate-700">
                    {appointment.service.name} con {appointment.staff.name} ·{' '}
                    {formatPrice(appointment.priceAtBooking)}
                  </p>
                  {appointment.notes && (
                    <p className="mt-1 text-xs text-slate-500">Notas: {appointment.notes}</p>
                  )}
                  <div className="mt-2">
                    <AppointmentStatusBadge status={appointment.status} />
                  </div>
                </div>
                {scope === 'upcoming' && (
                  <div className="flex flex-col items-start gap-1 sm:items-end">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={!cancellable}
                      onClick={() => setToCancel(appointment)}
                    >
                      Cancelar
                    </Button>
                    {!cancellable && (
                      <p className="text-xs text-slate-500">
                        Solo se puede cancelar con {cancellationHours} h de anticipación
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={toCancel !== null}
        title="Cancelar cita"
        description={
          toCancel && (
            <p>
              ¿Seguro que quieres cancelar tu cita de <strong>{toCancel.service.name}</strong> del{' '}
              {formatDateTime(toCancel.startsAt, timezone)}?
            </p>
          )
        }
        confirmLabel="Sí, cancelar"
        cancelLabel="No, mantener"
        danger
        loading={cancel.isPending}
        onConfirm={() => toCancel && cancel.mutate(toCancel.id)}
        onCancel={() => setToCancel(null)}
      />
    </div>
  );
}
