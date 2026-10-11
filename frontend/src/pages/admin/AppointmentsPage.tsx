import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchAppointments, type Appointment, type AppointmentStatus } from '@/api/appointments';
import { fetchStaff } from '@/api/staff';
import { AppointmentDetailModal } from '@/features/appointments/AppointmentDetailModal';
import { AppointmentStatusBadge } from '@/features/appointments/AppointmentStatusBadge';
import { STATUS_LABELS } from '@/features/appointments/status';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useSettings } from '@/hooks/useSettings';
import { formatDateTime, formatPrice, toDateString } from '@/lib/format';

const PAGE_SIZE = 20;

export function AppointmentsPage() {
  const [filters, setFilters] = useState(() => ({
    from: toDateString(new Date()),
    to: '',
    staffId: '',
    status: '' as '' | AppointmentStatus,
  }));
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const settings = useSettings();

  const staff = useQuery({ queryKey: ['staff', 'all'], queryFn: () => fetchStaff({ all: true }) });
  const query = {
    ...(filters.from && { from: filters.from }),
    ...(filters.to && { to: filters.to }),
    ...(filters.staffId && { staffId: filters.staffId }),
    ...(filters.status && { status: filters.status }),
    page,
    pageSize: PAGE_SIZE,
  };
  const appointments = useQuery({
    queryKey: ['appointments', 'admin', query],
    queryFn: () => fetchAppointments(query),
    placeholderData: keepPreviousData,
  });

  const update = (patch: Partial<typeof filters>) => {
    setFilters({ ...filters, ...patch });
    setPage(1);
  };

  const total = appointments.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Citas"
        description="Por defecto se muestran desde hoy; vacía «Desde» para ver el historial completo."
      />

      <div className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Desde"
          type="date"
          value={filters.from}
          onChange={(e) => update({ from: e.target.value })}
        />
        <Input
          label="Hasta"
          type="date"
          value={filters.to}
          min={filters.from}
          onChange={(e) => update({ to: e.target.value })}
        />
        <Select
          label="Profesional"
          value={filters.staffId}
          onChange={(e) => update({ staffId: e.target.value })}
        >
          <option value="">Todos</option>
          {staff.data?.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </Select>
        <Select
          label="Estado"
          value={filters.status}
          onChange={(e) => update({ status: e.target.value as '' | AppointmentStatus })}
        >
          <option value="">Todos</option>
          {(Object.keys(STATUS_LABELS) as AppointmentStatus[]).map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>

      {appointments.isPending && <TableSkeleton rows={6} />}
      {appointments.isError && (
        <ErrorMessage error={appointments.error} onRetry={() => appointments.refetch()} />
      )}
      {appointments.data && appointments.data.data.length === 0 && (
        <EmptyState title="No hay citas con esos filtros" />
      )}
      {appointments.data && appointments.data.data.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Servicio</th>
                  <th className="px-4 py-3">Profesional</th>
                  <th className="px-4 py-3">Precio</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.data.data.map((appointment) => (
                  <tr key={appointment.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-900">
                      {formatDateTime(appointment.startsAt, settings.data?.timezone)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-900">{appointment.client.name}</p>
                      <p className="text-xs text-slate-500">{appointment.client.email}</p>
                    </td>
                    <td className="px-4 py-3">{appointment.service.name}</td>
                    <td className="px-4 py-3">{appointment.staff.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatPrice(appointment.priceAtBooking)}
                    </td>
                    <td className="px-4 py-3">
                      <AppointmentStatusBadge status={appointment.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelected(appointment)}
                      >
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <span>
              {total} {total === 1 ? 'cita' : 'citas'} · página {page} de {pages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}

      <AppointmentDetailModal
        appointment={selected}
        timezone={settings.data?.timezone}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
