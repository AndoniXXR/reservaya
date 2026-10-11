import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { getApiErrorMessage } from '@/api/errors';
import {
  createTimeOff,
  deleteTimeOff,
  fetchStaffMember,
  fetchTimeOff,
  fetchWorkingHours,
  replaceWorkingHours,
  type AffectedAppointment,
  type TimeOff,
  type WorkingHours,
  type WorkingHoursBlock,
} from '@/api/staff';
import { AffectedAppointmentsNotice } from '@/features/admin/AffectedAppointmentsNotice';
import { useToast } from '@/components/toast/useToast';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { DAY_NAMES, formatDateTime } from '@/lib/format';

// Lunes primero, domingo al final
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function StaffDetailPage() {
  const { id = '' } = useParams();
  const member = useQuery({ queryKey: ['staff', id], queryFn: () => fetchStaffMember(id) });

  return (
    <div>
      <div className="mb-4">
        <Link to="/admin/profesionales" className="text-sm text-brand-600 hover:underline">
          ← Profesionales
        </Link>
      </div>
      {member.isPending && <TableSkeleton rows={2} />}
      {member.isError && <ErrorMessage error={member.error} onRetry={() => member.refetch()} />}
      {member.data && (
        <>
          <PageHeader title={member.data.name} description="Horario semanal y días libres" />
          <div className="flex flex-col gap-10">
            <WorkingHoursSection staffId={id} />
            <TimeOffManager staffId={id} />
          </div>
        </>
      )}
    </div>
  );
}

function WorkingHoursSection({ staffId }: { staffId: string }) {
  const hours = useQuery({
    queryKey: ['staff', staffId, 'working-hours'],
    queryFn: () => fetchWorkingHours(staffId),
  });

  if (hours.isPending) return <TableSkeleton rows={3} />;
  if (hours.isError) return <ErrorMessage error={hours.error} onRetry={() => hours.refetch()} />;
  // La clave reinicia el editor cuando llegan datos nuevos del servidor
  return (
    <WorkingHoursEditor
      key={hours.dataUpdatedAt}
      staffId={staffId}
      initial={hours.data}
      onSaved={() => hours.refetch()}
    />
  );
}

function WorkingHoursEditor({
  staffId,
  initial,
  onSaved,
}: {
  staffId: string;
  initial: WorkingHours[];
  onSaved: () => void;
}) {
  const toast = useToast();
  const [blocks, setBlocks] = useState<WorkingHoursBlock[]>(() =>
    initial.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })),
  );
  const [dirty, setDirty] = useState(false);
  const [affected, setAffected] = useState<AffectedAppointment[] | null>(null);

  const save = useMutation({
    mutationFn: () => replaceWorkingHours(staffId, blocks),
    onSuccess: ({ affectedAppointments }) => {
      setDirty(false);
      toast('Horario guardado', 'success');
      setAffected(affectedAppointments.length > 0 ? affectedAppointments : null);
      if (affectedAppointments.length === 0) onSaved();
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  const update = (next: WorkingHoursBlock[]) => {
    setBlocks(next);
    setDirty(true);
  };
  const addBlock = (dayOfWeek: number) => {
    const existing = blocks.filter((b) => b.dayOfWeek === dayOfWeek);
    const last = existing[existing.length - 1];
    update([
      ...blocks,
      { dayOfWeek, startTime: last ? last.endTime : '09:00', endTime: last ? '18:00' : '13:00' },
    ]);
  };
  const removeBlock = (index: number) => update(blocks.filter((_, i) => i !== index));
  const editBlock = (index: number, field: 'startTime' | 'endTime', value: string) =>
    update(blocks.map((b, i) => (i === index ? { ...b, [field]: value } : b)));

  return (
    <section aria-labelledby="horario">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="horario" className="text-lg font-semibold text-slate-900">
          Horario semanal
        </h2>
        <Button onClick={() => save.mutate()} disabled={!dirty} loading={save.isPending}>
          Guardar horario
        </Button>
      </div>
      {affected && (
        <AffectedAppointmentsNotice
          appointments={affected}
          onDismiss={() => {
            setAffected(null);
            onSaved();
          }}
        />
      )}
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {DAY_ORDER.map((day) => {
          const dayBlocks = blocks
            .map((block, index) => ({ block, index }))
            .filter(({ block }) => block.dayOfWeek === day);
          return (
            <div key={day} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
              <div className="w-28 shrink-0 pt-2 text-sm font-medium text-slate-800">
                {DAY_NAMES[day]}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {dayBlocks.length === 0 && (
                  <p className="pt-2 text-sm text-slate-400">No trabaja</p>
                )}
                {dayBlocks.map(({ block, index }) => (
                  <div key={index} className="flex flex-wrap items-end gap-2">
                    <Input
                      label="Desde"
                      type="time"
                      step={900}
                      value={block.startTime}
                      onChange={(e) => editBlock(index, 'startTime', e.target.value)}
                    />
                    <Input
                      label="Hasta"
                      type="time"
                      step={900}
                      value={block.endTime}
                      onChange={(e) => editBlock(index, 'endTime', e.target.value)}
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeBlock(index)}>
                      Quitar
                    </Button>
                  </div>
                ))}
                <div>
                  <Button variant="secondary" size="sm" onClick={() => addBlock(day)}>
                    Añadir bloque
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TimeOffManager({ staffId }: { staffId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = ['staff', staffId, 'time-off'];
  const timeOff = useQuery({ queryKey: key, queryFn: () => fetchTimeOff(staffId) });
  const [affected, setAffected] = useState<AffectedAppointment[] | null>(null);
  const [toDelete, setToDelete] = useState<TimeOff | null>(null);
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [formError, setFormError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      // Día completo en hora local: desde las 00:00 del inicio hasta las 00:00 del día siguiente al fin
      const startsAt = new Date(`${form.startDate}T00:00:00`);
      const endsAt = new Date(`${form.endDate || form.startDate}T00:00:00`);
      endsAt.setDate(endsAt.getDate() + 1);
      return createTimeOff(staffId, {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason: form.reason || null,
      });
    },
    onSuccess: ({ affectedAppointments }) => {
      queryClient.invalidateQueries({ queryKey: key });
      setForm({ startDate: '', endDate: '', reason: '' });
      toast('Día libre añadido', 'success');
      setAffected(affectedAppointments.length > 0 ? affectedAppointments : null);
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTimeOff(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      setToDelete(null);
      toast('Día libre eliminado', 'success');
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.startDate) {
      setFormError('Indica la fecha de inicio');
      return;
    }
    if (form.endDate && form.endDate < form.startDate) {
      setFormError('La fecha de fin no puede ser anterior a la de inicio');
      return;
    }
    setFormError(null);
    create.mutate();
  };

  return (
    <section aria-labelledby="dias-libres">
      <h2 id="dias-libres" className="mb-3 text-lg font-semibold text-slate-900">
        Días libres
      </h2>
      {affected && (
        <AffectedAppointmentsNotice appointments={affected} onDismiss={() => setAffected(null)} />
      )}
      <form
        onSubmit={submit}
        className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end"
      >
        <Input
          label="Desde"
          type="date"
          value={form.startDate}
          error={formError ?? undefined}
          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
        />
        <Input
          label="Hasta (opcional)"
          type="date"
          value={form.endDate}
          onChange={(e) => setForm({ ...form, endDate: e.target.value })}
        />
        <Input
          label="Motivo (opcional)"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
        />
        <Button type="submit" loading={create.isPending}>
          Añadir
        </Button>
      </form>

      {timeOff.isPending && <TableSkeleton rows={2} />}
      {timeOff.isError && <ErrorMessage error={timeOff.error} onRetry={() => timeOff.refetch()} />}
      {timeOff.data && timeOff.data.length === 0 && (
        <p className="text-sm text-slate-500">No hay días libres registrados.</p>
      )}
      {timeOff.data && timeOff.data.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {timeOff.data.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-slate-900">
                  {formatDateTime(item.startsAt)} → {formatDateTime(item.endsAt)}
                </p>
                {item.reason && <p className="text-xs text-slate-500">{item.reason}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setToDelete(item)}>
                Eliminar
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar día libre"
        description="El profesional volverá a estar disponible en ese periodo."
        confirmLabel="Eliminar"
        danger
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}
