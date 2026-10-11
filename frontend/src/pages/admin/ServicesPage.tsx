import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { getApiError, getApiErrorMessage } from '@/api/errors';
import {
  createService,
  fetchServices,
  toggleService,
  updateService,
  type Service,
} from '@/api/services';
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
import { useSettings } from '@/hooks/useSettings';
import { formatDuration, formatPrice } from '@/lib/format';

// El intervalo del negocio (15/30/60) se conoce en tiempo de ejecución, por eso el esquema se construye
const buildServiceSchema = (step: number) =>
  z.object({
    name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
    description: z.string().trim().max(300, 'Máximo 300 caracteres'),
    durationMinutes: z.coerce
      .number({ error: 'Indica la duración' })
      .int('Debe ser un número entero')
      .min(15, 'Mínimo 15 minutos')
      .max(240, 'Máximo 240 minutos')
      .multipleOf(step, `Debe ser múltiplo de ${step} minutos`),
    price: z.coerce
      .number({ error: 'Indica el precio' })
      .positive('Debe ser mayor que 0')
      .multipleOf(0.01, 'Máximo dos decimales'),
  });
// z.coerce acepta cualquier entrada (unknown) y produce números: RHF necesita ambos tipos
type ServiceFormInput = z.input<ReturnType<typeof buildServiceSchema>>;
type ServiceForm = z.output<ReturnType<typeof buildServiceSchema>>;

const servicesKey = ['services', 'all'] as const;

export function ServicesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Service | 'new' | null>(null);

  const services = useQuery({ queryKey: servicesKey, queryFn: () => fetchServices({ all: true }) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['services'] });

  const toggle = useMutation({
    mutationFn: (id: string) => toggleService(id),
    onSuccess: (service) => {
      invalidate();
      toast(service.active ? 'Servicio activado' : 'Servicio desactivado', 'success');
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  return (
    <div>
      <PageHeader
        title="Servicios"
        description="Lo que ofrece el negocio. Desactivar un servicio no borra sus citas."
        actions={<Button onClick={() => setEditing('new')}>Nuevo servicio</Button>}
      />

      {services.isPending && <TableSkeleton />}
      {services.isError && (
        <ErrorMessage error={services.error} onRetry={() => services.refetch()} />
      )}
      {services.data && services.data.length === 0 && (
        <EmptyState
          title="Aún no hay servicios"
          description="Crea el primero para que los clientes puedan reservar."
          action={<Button onClick={() => setEditing('new')}>Nuevo servicio</Button>}
        />
      )}
      {services.data && services.data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Servicio</th>
                <th className="px-4 py-3">Duración</th>
                <th className="px-4 py-3">Precio</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.data.map((service) => (
                <tr key={service.id} className={service.active ? '' : 'text-slate-400'}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{service.name}</p>
                    {service.description && (
                      <p className="text-xs text-slate-500">{service.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">{formatDuration(service.durationMinutes)}</td>
                  <td className="px-4 py-3">{formatPrice(service.price)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={service.active ? 'green' : 'gray'}>
                      {service.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(service)}>
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggle.mutate(service.id)}
                        disabled={toggle.isPending}
                      >
                        {service.active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ServiceFormModal
        service={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          invalidate();
          setEditing(null);
        }}
      />
    </div>
  );
}

function ServiceFormModal({
  service,
  onClose,
  onSaved,
}: {
  service: Service | 'new' | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const settings = useSettings();
  const isNew = service === 'new';
  const current = isNew || service === null ? null : service;
  const step = settings.data?.slotIntervalMinutes ?? 15;
  const schema = useMemo(() => buildServiceSchema(step), [step]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ServiceFormInput, unknown, ServiceForm>({
    resolver: zodResolver(schema),
    values: {
      name: current?.name ?? '',
      description: current?.description ?? '',
      durationMinutes: current?.durationMinutes ?? 30,
      price: current?.price ?? 0,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ServiceForm) => {
      const payload = { ...values, description: values.description || null };
      return current ? updateService(current.id, payload) : createService(payload);
    },
    onSuccess: () => {
      toast(current ? 'Servicio actualizado' : 'Servicio creado', 'success');
      onSaved();
    },
    onError: (error) => {
      // Un error de validación del servidor se muestra junto al campo, sin prefijo genérico
      const detail = getApiError(error)?.details?.durationMinutes;
      if (detail) setError('durationMinutes', { message: detail });
      else toast(getApiErrorMessage(error), 'error');
    },
  });

  return (
    <Modal
      open={service !== null}
      title={current ? 'Editar servicio' : 'Nuevo servicio'}
      onClose={onClose}
    >
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <Input label="Nombre" error={errors.name?.message} {...register('name')} />
        <Textarea
          label="Descripción (opcional)"
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Duración (minutos)"
            type="number"
            min={15}
            max={240}
            step={step}
            hint={`Múltiplo de ${step}`}
            error={errors.durationMinutes?.message}
            {...register('durationMinutes')}
          />
          <Input
            label="Precio (Q)"
            type="number"
            min={0}
            step={0.01}
            error={errors.price?.message}
            {...register('price')}
          />
        </div>
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
