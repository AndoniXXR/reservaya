import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { cancelAppointment, updateAppointmentStatus, type Appointment } from '@/api/appointments';
import { getApiErrorMessage } from '@/api/errors';
import { useToast } from '@/components/toast/useToast';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { formatDateTime, formatDuration, formatPrice } from '@/lib/format';
import { AppointmentStatusBadge } from './AppointmentStatusBadge';

/** Detalle de una cita para el admin, con cancelar / completada / no asistió. */
export function AppointmentDetailModal({
  appointment,
  timezone,
  onClose,
}: {
  appointment: Appointment | null;
  timezone?: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Fijado al abrir: el render debe ser puro
  const [now] = useState(() => Date.now());

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    queryClient.invalidateQueries({ queryKey: ['availability'] });
  };

  const cancel = useMutation({
    mutationFn: (id: string) => cancelAppointment(id),
    onSuccess: () => {
      refresh();
      setConfirmCancel(false);
      toast('Cita cancelada', 'success');
      onClose();
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  const setStatus = useMutation({
    mutationFn: (status: 'COMPLETED' | 'NO_SHOW') =>
      updateAppointmentStatus(appointment!.id, status),
    onSuccess: (updated) => {
      refresh();
      toast(
        updated.status === 'COMPLETED' ? 'Marcada como completada' : 'Marcada como no asistió',
        'success',
      );
      onClose();
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  if (!appointment) return null;

  const started = new Date(appointment.startsAt).getTime() <= now;
  const confirmed = appointment.status === 'CONFIRMED';

  return (
    <>
      <Modal open title="Detalle de la cita" onClose={onClose}>
        <div className="mb-4">
          <AppointmentStatusBadge status={appointment.status} />
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Item label="Fecha y hora" value={formatDateTime(appointment.startsAt, timezone)} />
          <Item
            label="Servicio"
            value={`${appointment.service.name} · ${formatDuration(appointment.service.durationMinutes)}`}
          />
          <Item label="Profesional" value={appointment.staff.name} />
          <Item label="Precio" value={formatPrice(appointment.priceAtBooking)} />
          <Item label="Cliente" value={appointment.client.name} />
          <Item
            label="Contacto"
            value={[appointment.client.email, appointment.client.phone].filter(Boolean).join(' · ')}
          />
          {appointment.notes && <Item label="Notas" value={appointment.notes} />}
          {appointment.cancelledAt && (
            <Item
              label="Cancelada"
              value={`${formatDateTime(appointment.cancelledAt, timezone)} por ${
                appointment.cancelledBy === 'ADMIN' ? 'el negocio' : 'el cliente'
              }`}
            />
          )}
        </dl>
        {confirmed && (
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)}>
              Cancelar cita
            </Button>
            {started ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setStatus.mutate('NO_SHOW')}
                  loading={setStatus.isPending && setStatus.variables === 'NO_SHOW'}
                >
                  No asistió
                </Button>
                <Button
                  size="sm"
                  onClick={() => setStatus.mutate('COMPLETED')}
                  loading={setStatus.isPending && setStatus.variables === 'COMPLETED'}
                >
                  Completada
                </Button>
              </>
            ) : (
              <p className="self-center text-xs text-slate-500">
                Podrás marcarla como completada cuando empiece
              </p>
            )}
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={confirmCancel}
        title="Cancelar cita"
        description="Se avisará al cliente por correo de que el negocio canceló la cita."
        confirmLabel="Sí, cancelar"
        danger
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(appointment.id)}
        onCancel={() => setConfirmCancel(false)}
      />
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
