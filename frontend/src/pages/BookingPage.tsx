import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { createAppointment, type Appointment } from '@/api/appointments';
import { fetchAvailability, type Slot } from '@/api/availability';
import { getApiError, getApiErrorMessage } from '@/api/errors';
import { fetchServices, type Service } from '@/api/services';
import { fetchStaff } from '@/api/staff';
import { useToast } from '@/components/toast/useToast';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Calendar } from '@/components/ui/Calendar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/features/auth/useAuth';
import {
  clearDraft,
  EMPTY_DRAFT,
  loadDraft,
  saveDraft,
  type BookingDraft,
} from '@/features/booking/draft';
import { useSettings } from '@/hooks/useSettings';
import { formatDateTime, formatDuration, formatPrice, toDateString } from '@/lib/format';

const STEPS = ['Servicio', 'Profesional', 'Fecha y hora', 'Confirmar'];

export function BookingPage() {
  const location = useLocation();
  // Servicio elegido desde el botón "Reservar" del inicio; se consume una sola vez
  const [preselectedId, setPreselectedId] = useState<string | undefined>(
    () => (location.state as { serviceId?: string } | null)?.serviceId,
  );
  const [draft, setDraft] = useState<BookingDraft>(() => {
    const stored = loadDraft();
    return preselectedId && stored.service?.id !== preselectedId ? EMPTY_DRAFT : stored;
  });
  const [done, setDone] = useState<Appointment | null>(null);

  useEffect(() => saveDraft(draft), [draft]);

  const update = (patch: Partial<BookingDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const goTo = (step: BookingDraft['step']) => update({ step });

  if (done) {
    return <SuccessView appointment={done} />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Reservar una cita</h1>
      <Stepper current={draft.step} onSelect={goTo} draft={draft} />

      {draft.step === 1 && (
        <ServiceStep
          preselectedId={preselectedId}
          selected={draft.service}
          onSelect={(service) => {
            setPreselectedId(undefined);
            update({
              service,
              staffId: null,
              staffName: null,
              date: null,
              slot: null,
              step: 2,
            });
          }}
        />
      )}
      {draft.step === 2 && draft.service && (
        <StaffStep
          serviceId={draft.service.id}
          selectedId={draft.staffId}
          onSelect={(staffId, staffName) => update({ staffId, staffName, slot: null, step: 3 })}
          onBack={() => goTo(1)}
        />
      )}
      {draft.step === 3 && draft.service && (
        <DateTimeStep
          service={draft.service}
          staffId={draft.staffId}
          date={draft.date}
          slot={draft.slot}
          onDate={(date) => update({ date, slot: null })}
          onSlot={(slot) => update({ slot, step: 4 })}
          onBack={() => goTo(2)}
        />
      )}
      {draft.step === 4 && draft.service && draft.slot && (
        <ConfirmStep
          draft={draft}
          onNotes={(notes) => update({ notes })}
          onBack={() => goTo(3)}
          onConflict={() => update({ slot: null, step: 3 })}
          onSuccess={(appointment) => {
            clearDraft();
            setDone(appointment);
          }}
        />
      )}
    </div>
  );
}

function Stepper({
  current,
  onSelect,
  draft,
}: {
  current: number;
  onSelect: (step: BookingDraft['step']) => void;
  draft: BookingDraft;
}) {
  const summaries = [
    draft.service?.name,
    draft.staffId === null && draft.service ? 'Cualquiera' : draft.staffName,
    draft.slot ? formatDateTime(draft.slot.startsAt) : null,
    null,
  ];
  return (
    <ol className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Pasos">
      {STEPS.map((label, index) => {
        const step = (index + 1) as BookingDraft['step'];
        const isDone = step < current;
        const isCurrent = step === current;
        return (
          <li key={label}>
            <button
              type="button"
              disabled={!isDone}
              onClick={() => onSelect(step)}
              aria-current={isCurrent ? 'step' : undefined}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                isCurrent
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : isDone
                    ? 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    : 'border-slate-100 bg-slate-50 text-slate-400'
              }`}
            >
              <span className="block text-xs uppercase tracking-wide">
                {index + 1}. {label}
              </span>
              {isDone && summaries[index] && (
                <span className="block truncate font-medium">{summaries[index]}</span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function ServiceStep({
  preselectedId,
  selected,
  onSelect,
}: {
  preselectedId?: string;
  selected: Service | null;
  onSelect: (service: Service) => void;
}) {
  const services = useQuery({ queryKey: ['services'], queryFn: () => fetchServices() });

  // Si se llegó desde el botón "Reservar" de un servicio concreto, saltar este paso
  const preselected = preselectedId
    ? services.data?.find((s) => s.id === preselectedId)
    : undefined;
  useEffect(() => {
    if (preselected) onSelect(preselected);
  }, [preselected, onSelect]);

  if (services.isPending) return <TableSkeleton rows={3} />;
  if (services.isError)
    return <ErrorMessage error={services.error} onRetry={() => services.refetch()} />;
  if (services.data.length === 0) {
    return (
      <EmptyState
        title="No hay servicios disponibles"
        description="Vuelve a intentarlo más tarde."
      />
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">¿Qué servicio necesitas?</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {services.data.map((service) => (
          <button
            key={service.id}
            type="button"
            onClick={() => onSelect(service)}
            aria-pressed={selected?.id === service.id}
            className={`rounded-xl border p-4 text-left transition hover:border-brand-500 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-brand-600 ${
              selected?.id === service.id
                ? 'border-brand-600 bg-brand-50'
                : 'border-slate-200 bg-white'
            }`}
          >
            <p className="font-semibold text-slate-900">{service.name}</p>
            {service.description && (
              <p className="mt-1 text-sm text-slate-500">{service.description}</p>
            )}
            <p className="mt-2 text-sm text-slate-700">
              {formatDuration(service.durationMinutes)} ·{' '}
              <span className="font-medium">{formatPrice(service.price)}</span>
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function StaffStep({
  serviceId,
  selectedId,
  onSelect,
  onBack,
}: {
  serviceId: string;
  selectedId: string | null;
  onSelect: (staffId: string | null, staffName: string | null) => void;
  onBack: () => void;
}) {
  const staff = useQuery({
    queryKey: ['staff', { serviceId }],
    queryFn: () => fetchStaff({ serviceId }),
  });

  if (staff.isPending) return <TableSkeleton rows={3} />;
  if (staff.isError) return <ErrorMessage error={staff.error} onRetry={() => staff.refetch()} />;

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">¿Con quién?</h2>
      {staff.data.length === 0 ? (
        <EmptyState
          title="Nadie ofrece este servicio por ahora"
          action={
            <Button variant="secondary" onClick={onBack}>
              Elegir otro servicio
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelect(null, null)}
            aria-pressed={selectedId === null}
            className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-left transition hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <p className="font-semibold text-slate-900">Cualquiera disponible</p>
            <p className="mt-1 text-sm text-slate-500">Te mostramos todos los horarios libres.</p>
          </button>
          {staff.data.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelect(member.id, member.name)}
              aria-pressed={selectedId === member.id}
              className={`rounded-xl border p-4 text-left transition hover:border-brand-500 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-brand-600 ${
                selectedId === member.id
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <p className="font-semibold text-slate-900">{member.name}</p>
              {member.bio && <p className="mt-1 text-sm text-slate-500">{member.bio}</p>}
            </button>
          ))}
        </div>
      )}
      <div className="mt-6">
        <Button variant="secondary" onClick={onBack}>
          Atrás
        </Button>
      </div>
    </div>
  );
}

function DateTimeStep({
  service,
  staffId,
  date,
  slot,
  onDate,
  onSlot,
  onBack,
}: {
  service: Service;
  staffId: string | null;
  date: string | null;
  slot: Slot | null;
  onDate: (date: string) => void;
  onSlot: (slot: Slot) => void;
  onBack: () => void;
}) {
  const settings = useSettings();
  // Fijado al montar para que el render sea puro
  const [today] = useState(() => new Date());
  const minDate = toDateString(today);
  const maxDate = toDateString(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + (settings.data?.maxAdvanceDays ?? 30),
    ),
  );

  const availability = useQuery({
    queryKey: ['availability', { serviceId: service.id, staffId, date }],
    queryFn: () => fetchAvailability({ serviceId: service.id, staffId, date: date! }),
    enabled: date !== null,
    staleTime: 0,
  });

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">¿Cuándo?</h2>
      <div className="flex flex-col gap-6 md:flex-row">
        <Calendar value={date} onChange={onDate} minDate={minDate} maxDate={maxDate} />
        <div className="flex-1">
          {!date && (
            <p className="text-sm text-slate-500">
              Elige un día para ver los horarios disponibles.
            </p>
          )}
          {date && availability.isPending && (
            <div
              className="grid grid-cols-3 gap-2 sm:grid-cols-4"
              role="status"
              aria-label="Cargando horarios"
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          )}
          {date && availability.isError && (
            <ErrorMessage error={availability.error} onRetry={() => availability.refetch()} />
          )}
          {date && availability.data && availability.data.slots.length === 0 && (
            <EmptyState
              title="No hay horarios disponibles ese día"
              description="Prueba con otra fecha o con otro profesional."
            />
          )}
          {date && availability.data && availability.data.slots.length > 0 && (
            <div
              className="grid grid-cols-3 gap-2 sm:grid-cols-4"
              role="group"
              aria-label="Horarios disponibles"
            >
              {availability.data.slots.map((s) => {
                const isSelected = slot?.startsAt === s.startsAt && slot.staffId === s.staffId;
                return (
                  <button
                    key={`${s.staffId}-${s.startsAt}`}
                    type="button"
                    onClick={() => onSlot(s)}
                    aria-pressed={isSelected}
                    className={`rounded-lg border px-2 py-2 text-sm transition hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-brand-600 ${
                      isSelected
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-800'
                    }`}
                  >
                    <span className="block font-medium">{s.label}</span>
                    {staffId === null && (
                      <span className="block truncate text-xs text-slate-500">{s.staffName}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="mt-6">
        <Button variant="secondary" onClick={onBack}>
          Atrás
        </Button>
      </div>
    </div>
  );
}

function ConfirmStep({
  draft,
  onNotes,
  onBack,
  onConflict,
  onSuccess,
}: {
  draft: BookingDraft;
  onNotes: (notes: string) => void;
  onBack: () => void;
  onConflict: () => void;
  onSuccess: (appointment: Appointment) => void;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useSettings();
  const { service, slot } = draft;
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createAppointment({
        serviceId: service!.id,
        staffId: slot!.staffId,
        startsAt: slot!.startsAt,
        notes: draft.notes.trim() || null,
      }),
    onSuccess: (appointment) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      toast('Reserva confirmada', 'success');
      onSuccess(appointment);
    },
    onError: (err) => {
      const apiError = getApiError(err);
      if (apiError?.code === 'CONFLICT') {
        toast(apiError.message, 'error');
        queryClient.invalidateQueries({ queryKey: ['availability'] });
        onConflict();
        return;
      }
      setError(getApiErrorMessage(err));
    },
  });

  const confirm = () => {
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }
    mutation.mutate();
  };

  if (!service || !slot) return null;

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Confirma tu reserva</h2>
      <dl className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Servicio</dt>
          <dd className="font-medium text-slate-900">{service.name}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Profesional</dt>
          <dd className="font-medium text-slate-900">{slot.staffName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Fecha y hora</dt>
          <dd className="font-medium text-slate-900">
            {formatDateTime(slot.startsAt, settings.data?.timezone)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Duración y precio</dt>
          <dd className="font-medium text-slate-900">
            {formatDuration(service.durationMinutes)} · {formatPrice(service.price)}
          </dd>
        </div>
      </dl>
      <Textarea
        label="Notas para el profesional (opcional)"
        maxLength={300}
        value={draft.notes}
        onChange={(e) => onNotes(e.target.value)}
      />
      {error && (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {!user && !loading && (
        <div className="mt-4">
          <Alert tone="info">
            Para confirmar necesitas iniciar sesión. Tu selección se conserva.{' '}
            <Link to="/registro" state={{ from: location }} className="font-medium underline">
              ¿No tienes cuenta?
            </Link>
          </Alert>
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-between gap-2">
        <Button variant="secondary" onClick={onBack}>
          Atrás
        </Button>
        <Button size="lg" onClick={confirm} loading={mutation.isPending} disabled={loading}>
          {user ? 'Confirmar reserva' : 'Iniciar sesión y confirmar'}
        </Button>
      </div>
    </div>
  );
}

function SuccessView({ appointment }: { appointment: Appointment }) {
  const settings = useSettings();
  return (
    <div className="mx-auto w-full max-w-lg text-center">
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700"
        aria-hidden="true"
      >
        ✓
      </div>
      <h1 className="text-2xl font-bold text-slate-900">¡Cita reservada!</h1>
      <p className="mt-2 text-slate-600">Te enviamos un correo con los detalles.</p>
      <dl className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-5 text-left sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Servicio</dt>
          <dd className="font-medium text-slate-900">{appointment.service.name}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Profesional</dt>
          <dd className="font-medium text-slate-900">{appointment.staff.name}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Fecha y hora</dt>
          <dd className="font-medium text-slate-900">
            {formatDateTime(appointment.startsAt, settings.data?.timezone)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Precio</dt>
          <dd className="font-medium text-slate-900">{formatPrice(appointment.priceAtBooking)}</dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          to="/mis-citas"
          className="inline-flex items-center rounded-lg bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700"
        >
          Ver mis citas
        </Link>
        <Link
          to="/"
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-800 hover:bg-slate-50"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
