import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { fetchServices } from '@/api/services';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { useSettings } from '@/hooks/useSettings';
import { formatDuration, formatPrice } from '@/lib/format';

export function HomePage() {
  const settings = useSettings();
  const services = useQuery({ queryKey: ['services'], queryFn: () => fetchServices() });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <section className="mb-10 text-center">
        {settings.isPending ? (
          <Skeleton className="mx-auto h-10 w-64" />
        ) : (
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            {settings.data?.businessName ?? 'ReservaYa'}
          </h1>
        )}
        {settings.data?.description && (
          <p className="mx-auto mt-3 max-w-xl text-lg text-slate-600">
            {settings.data.description}
          </p>
        )}
        {settings.data?.address && (
          <p className="mt-2 text-sm text-slate-500">{settings.data.address}</p>
        )}
        <Link
          to="/reservar"
          className="mt-6 inline-flex items-center rounded-lg bg-brand-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-brand-700"
        >
          Reservar una cita
        </Link>
      </section>

      <section aria-labelledby="servicios">
        <h2 id="servicios" className="mb-4 text-xl font-semibold text-slate-900">
          Servicios
        </h2>
        {services.isPending && <TableSkeleton rows={3} />}
        {services.isError && (
          <ErrorMessage error={services.error} onRetry={() => services.refetch()} />
        )}
        {services.data && services.data.length === 0 && (
          <EmptyState title="Pronto publicaremos nuestros servicios" />
        )}
        {services.data && services.data.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {services.data.map((service) => (
              <li
                key={service.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <div>
                  <p className="font-semibold text-slate-900">{service.name}</p>
                  {service.description && (
                    <p className="mt-1 text-sm text-slate-500">{service.description}</p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-700">
                    {formatDuration(service.durationMinutes)} ·{' '}
                    <span className="font-medium">{formatPrice(service.price)}</span>
                  </p>
                  <Link
                    to="/reservar"
                    state={{ serviceId: service.id }}
                    className="rounded-lg border border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                  >
                    Reservar
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
