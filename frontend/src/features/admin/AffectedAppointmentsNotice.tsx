import type { AffectedAppointment } from '@/api/staff';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/format';

/**
 * Los cambios de horario, días libres y desactivaciones no tocan las citas ya confirmadas:
 * se listan aquí para que el admin decida qué hacer con cada una.
 */
export function AffectedAppointmentsNotice({
  appointments,
  onDismiss,
}: {
  appointments: AffectedAppointment[];
  onDismiss: () => void;
}) {
  return (
    <div className="mb-6">
      <Alert tone="warning">
        <p className="font-medium">
          {appointments.length === 1
            ? 'Hay 1 cita confirmada que queda fuera del nuevo horario.'
            : `Hay ${appointments.length} citas confirmadas que quedan fuera del nuevo horario.`}
        </p>
        <p className="mt-1">
          No se han modificado. Revísalas en la sección de citas y cancélalas o reprográmalas con el
          cliente.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {appointments.map((appointment) => (
            <li key={appointment.id}>
              {formatDateTime(appointment.startsAt)} · {appointment.clientName} ·{' '}
              {appointment.serviceName}
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={onDismiss}>
            Entendido
          </Button>
        </div>
      </Alert>
    </div>
  );
}
