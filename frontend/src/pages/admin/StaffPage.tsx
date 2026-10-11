import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { getApiErrorMessage } from '@/api/errors';
import { fetchServices } from '@/api/services';
import {
  createStaff,
  fetchStaff,
  toggleStaff,
  updateStaff,
  type AffectedAppointment,
  type Staff,
} from '@/api/staff';
import { AffectedAppointmentsNotice } from '@/features/admin/AffectedAppointmentsNotice';
import { useToast } from '@/components/toast/useToast';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';

const staffSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
  bio: z.string().trim().max(300, 'Máximo 300 caracteres'),
  serviceIds: z.array(z.string()),
});
type StaffForm = z.infer<typeof staffSchema>;

const staffQueryKey = ['staff', 'all'] as const;

export function StaffPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Staff | 'new' | null>(null);
  const [affected, setAffected] = useState<AffectedAppointment[] | null>(null);

  const staff = useQuery({ queryKey: staffQueryKey, queryFn: () => fetchStaff({ all: true }) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['staff'] });

  const toggle = useMutation({
    mutationFn: toggleStaff,
    onSuccess: ({ staff: member, affectedAppointments }) => {
      invalidate();
      toast(member.active ? 'Profesional activado' : 'Profesional desactivado', 'success');
      setAffected(affectedAppointments.length > 0 ? affectedAppointments : null);
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  return (
    <div>
      <PageHeader
        title="Profesionales"
        description="Quién atiende y qué servicios ofrece cada uno."
        actions={<Button onClick={() => setEditing('new')}>Nuevo profesional</Button>}
      />

      {affected && (
        <AffectedAppointmentsNotice appointments={affected} onDismiss={() => setAffected(null)} />
      )}

      {staff.isPending && <TableSkeleton />}
      {staff.isError && <ErrorMessage error={staff.error} onRetry={() => staff.refetch()} />}
      {staff.data && staff.data.length === 0 && (
        <EmptyState
          title="Aún no hay profesionales"
          description="Añade a quienes atienden las citas."
          action={<Button onClick={() => setEditing('new')}>Nuevo profesional</Button>}
        />
      )}
      {staff.data && staff.data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Servicios</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.data.map((member) => (
                <tr key={member.id} className={member.active ? '' : 'text-slate-400'}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{member.name}</p>
                    {member.bio && <p className="text-xs text-slate-500">{member.bio}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {member.services.length === 0 && (
                        <span className="text-xs text-slate-400">Sin servicios</span>
                      )}
                      {member.services.map((service) => (
                        <Badge key={service.id} tone="blue">
                          {service.name}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={member.active ? 'green' : 'gray'}>
                      {member.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/admin/profesionales/${member.id}`}
                        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                      >
                        Horario
                      </Link>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(member)}>
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggle.mutate(member.id)}
                        disabled={toggle.isPending}
                      >
                        {member.active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StaffFormModal
        staff={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          invalidate();
          setEditing(null);
        }}
      />
    </div>
  );
}

function StaffFormModal({
  staff,
  onClose,
  onSaved,
}: {
  staff: Staff | 'new' | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const current = staff === 'new' || staff === null ? null : staff;
  const services = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => fetchServices({ all: true }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StaffForm>({
    resolver: zodResolver(staffSchema),
    values: {
      name: current?.name ?? '',
      bio: current?.bio ?? '',
      serviceIds: current?.services.map((s) => s.id) ?? [],
    },
  });

  const mutation = useMutation({
    mutationFn: (values: StaffForm) => {
      const payload = { name: values.name, bio: values.bio || null, serviceIds: values.serviceIds };
      return current ? updateStaff(current.id, payload) : createStaff(payload);
    },
    onSuccess: () => {
      toast(current ? 'Profesional actualizado' : 'Profesional creado', 'success');
      onSaved();
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  return (
    <Modal
      open={staff !== null}
      title={current ? 'Editar profesional' : 'Nuevo profesional'}
      onClose={onClose}
    >
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <Input label="Nombre" error={errors.name?.message} {...register('name')} />
        <Textarea label="Bio (opcional)" error={errors.bio?.message} {...register('bio')} />
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Servicios que ofrece</legend>
          {services.data?.length === 0 && (
            <p className="text-sm text-slate-500">Primero crea servicios.</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {services.data
              ?.filter((s) => s.active || current?.services.some((cs) => cs.id === s.id))
              .map((service) => (
                <label key={service.id} className="flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    value={service.id}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    {...register('serviceIds')}
                  />
                  {service.name}
                  {!service.active && <span className="text-xs text-slate-400">(inactivo)</span>}
                </label>
              ))}
          </div>
        </fieldset>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
