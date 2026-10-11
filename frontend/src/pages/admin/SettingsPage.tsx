import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { getApiErrorMessage } from '@/api/errors';
import { updateSettings, type BusinessSettings } from '@/api/settings';
import { useToast } from '@/components/toast/useToast';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { settingsQueryKey, useSettings } from '@/hooks/useSettings';

const settingsSchema = z.object({
  businessName: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
  slotIntervalMinutes: z.coerce
    .number()
    .pipe(z.union([z.literal(15), z.literal(30), z.literal(60)])),
  minAdvanceHours: z.coerce.number().int().min(0, 'Mínimo 0').max(72, 'Máximo 72'),
  maxAdvanceDays: z.coerce.number().int().min(1, 'Mínimo 1').max(365, 'Máximo 365'),
  cancellationHours: z.coerce.number().int().min(0, 'Mínimo 0').max(168, 'Máximo 168'),
  contactPhone: z.string().trim().max(20, 'Máximo 20 caracteres'),
  address: z.string().trim().max(200, 'Máximo 200 caracteres'),
  description: z.string().trim().max(500, 'Máximo 500 caracteres'),
});
// z.coerce acepta cualquier entrada (unknown) y produce números: RHF necesita ambos tipos
type SettingsFormInput = z.input<typeof settingsSchema>;
type SettingsForm = z.output<typeof settingsSchema>;

export function SettingsPage() {
  const settings = useSettings();

  return (
    <div>
      <PageHeader title="Configuración" description="Datos del negocio y reglas de reserva." />
      {settings.isPending && <TableSkeleton rows={5} />}
      {settings.isError && (
        <ErrorMessage error={settings.error} onRetry={() => settings.refetch()} />
      )}
      {settings.data && <SettingsForm initial={settings.data} />}
    </div>
  );
}

function SettingsForm({ initial }: { initial: BusinessSettings }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsFormInput, unknown, SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      businessName: initial.businessName,
      slotIntervalMinutes: initial.slotIntervalMinutes as 15 | 30 | 60,
      minAdvanceHours: initial.minAdvanceHours,
      maxAdvanceDays: initial.maxAdvanceDays,
      cancellationHours: initial.cancellationHours,
      contactPhone: initial.contactPhone ?? '',
      address: initial.address ?? '',
      description: initial.description ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: SettingsForm) =>
      updateSettings({
        ...values,
        contactPhone: values.contactPhone || null,
        address: values.address || null,
        description: values.description || null,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(settingsQueryKey, saved);
      reset({
        ...saved,
        slotIntervalMinutes: saved.slotIntervalMinutes as 15 | 30 | 60,
        contactPhone: saved.contactPhone ?? '',
        address: saved.address ?? '',
        description: saved.description ?? '',
      });
      toast('Configuración guardada', 'success');
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
      className="flex max-w-2xl flex-col gap-6"
    >
      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Negocio</h2>
        <Input
          label="Nombre del negocio"
          error={errors.businessName?.message}
          {...register('businessName')}
        />
        <Textarea
          label="Descripción"
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Teléfono de contacto"
            type="tel"
            error={errors.contactPhone?.message}
            {...register('contactPhone')}
          />
          <Input label="Dirección" error={errors.address?.message} {...register('address')} />
        </div>
        <p className="text-xs text-slate-500">Zona horaria: {initial.timezone}</p>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Reglas de reserva</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Intervalo entre horarios"
            error={errors.slotIntervalMinutes?.message}
            {...register('slotIntervalMinutes')}
          >
            <option value={15}>Cada 15 minutos</option>
            <option value={30}>Cada 30 minutos</option>
            <option value={60}>Cada 60 minutos</option>
          </Select>
          <Input
            label="Anticipación mínima (horas)"
            type="number"
            min={0}
            error={errors.minAdvanceHours?.message}
            {...register('minAdvanceHours')}
          />
          <Input
            label="Anticipación máxima (días)"
            type="number"
            min={1}
            error={errors.maxAdvanceDays?.message}
            {...register('maxAdvanceDays')}
          />
          <Input
            label="Horas mínimas para cancelar"
            type="number"
            min={0}
            hint="El cliente solo puede cancelar con esta anticipación"
            error={errors.cancellationHours?.message}
            {...register('cancellationHours')}
          />
        </div>
      </section>

      <div>
        <Button type="submit" disabled={!isDirty} loading={mutation.isPending}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
