import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '@/api/health';

export function HomePage() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth, retry: 1 });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-brand-700">ReservaYa</h1>
      <p className="text-lg text-slate-600">Reserva tu cita en línea en segundos.</p>

      <section
        aria-live="polite"
        className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Estado del sistema
        </h2>
        {health.isPending && <p className="text-slate-500">Comprobando conexión con la API…</p>}
        {health.isError && (
          <p className="text-red-600">
            No se pudo contactar con la API. ¿Está el backend en marcha?
          </p>
        )}
        {health.data && (
          <dl className="grid grid-cols-2 gap-2 text-left">
            <dt className="text-slate-500">API</dt>
            <dd className="font-medium text-emerald-600">{health.data.status}</dd>
            <dt className="text-slate-500">Base de datos</dt>
            <dd
              className={
                health.data.db === 'ok'
                  ? 'font-medium text-emerald-600'
                  : 'font-medium text-red-600'
              }
            >
              {health.data.db}
            </dd>
          </dl>
        )}
      </section>
    </main>
  );
}
