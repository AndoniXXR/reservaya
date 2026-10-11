import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchOverview } from '@/api/stats';
import { STATUS_LABELS } from '@/features/appointments/status';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatPrice, toDateString } from '@/lib/format';

// Un solo matiz (la marca) para cada gráfica de una serie; texto siempre en tokens de texto
const SERIES_COLOR = '#2f6fe4';
const GRID_COLOR = '#e2e8f0';
const AXIS_COLOR = '#64748b';

type Preset = '7d' | '30d' | 'month';

function presetRange(preset: Preset): { from: string; to: string } {
  const today = new Date();
  const to = toDateString(today);
  if (preset === 'month') {
    return { from: toDateString(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  }
  const days = preset === '7d' ? 6 : 29;
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  return { from: toDateString(from), to };
}

export function AdminDashboardPage() {
  const [range, setRange] = useState(() => presetRange('30d'));
  const stats = useQuery({
    queryKey: ['stats', 'overview', range],
    queryFn: () => fetchOverview(range),
    enabled: range.from <= range.to,
  });

  const invalidRange = range.from > range.to;
  const data = stats.data;
  const noShow = data?.noShowRate;

  return (
    <div>
      <PageHeader title="Dashboard" description="Resumen de la actividad del negocio." />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Citas hoy" value={data ? String(data.highlights.today) : null} />
        <StatTile
          label="Citas esta semana"
          value={data ? String(data.highlights.thisWeek) : null}
        />
        <StatTile
          label="Ingresos del mes"
          value={data ? formatPrice(data.highlights.monthRevenue) : null}
          hint="Citas completadas"
        />
        <StatTile
          label="Tasa de inasistencia"
          value={data ? (noShow === null ? '—' : `${(noShow! * 100).toFixed(0)} %`) : null}
          hint="En el rango elegido"
        />
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex gap-1">
          {(['7d', '30d', 'month'] as const).map((preset) => (
            <Button
              key={preset}
              size="sm"
              variant="secondary"
              onClick={() => setRange(presetRange(preset))}
            >
              {preset === '7d'
                ? 'Últimos 7 días'
                : preset === '30d'
                  ? 'Últimos 30 días'
                  : 'Este mes'}
            </Button>
          ))}
        </div>
        <Input
          label="Desde"
          type="date"
          value={range.from}
          max={range.to}
          onChange={(e) => setRange({ ...range, from: e.target.value })}
        />
        <Input
          label="Hasta"
          type="date"
          value={range.to}
          min={range.from}
          onChange={(e) => setRange({ ...range, to: e.target.value })}
        />
      </div>

      {invalidRange && (
        <div className="mb-6">
          <Alert tone="warning">La fecha inicial no puede ser posterior a la final.</Alert>
        </div>
      )}
      {stats.isError && <ErrorMessage error={stats.error} onRetry={() => stats.refetch()} />}

      {/* Con un rango inválido no hay nada que mostrar: solo el aviso */}
      <div className={`grid gap-6 lg:grid-cols-3 ${invalidRange ? 'hidden' : ''}`}>
        <section
          className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2"
          aria-labelledby="por-dia"
        >
          <h2 id="por-dia" className="mb-1 font-semibold text-slate-900">
            Citas por día
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Confirmadas, completadas y no asistidas; sin canceladas
          </p>
          {data ? (
            data.appointmentsPerDay.every((d) => d.count === 0) ? (
              <p className="py-12 text-center text-sm text-slate-500">Sin citas en este rango</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.appointmentsPerDay}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value: string) => value.slice(5)}
                      tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: GRID_COLOR }}
                      minTickGap={24}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      separator=": "
                      cursor={{ stroke: AXIS_COLOR, strokeDasharray: '3 3' }}
                      formatter={(value) => [String(value), 'Citas']}
                      labelFormatter={(label) => `Día ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={SERIES_COLOR}
                      strokeWidth={2}
                      dot={{ r: 3, fill: SERIES_COLOR, strokeWidth: 0 }}
                      activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )
          ) : (
            <Skeleton className="h-64" />
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4" aria-labelledby="top">
          <h2 id="top" className="mb-1 font-semibold text-slate-900">
            Servicios más reservados
          </h2>
          <p className="mb-4 text-xs text-slate-500">Los 5 más reservados del rango</p>
          {data ? (
            data.topServices.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">Sin datos</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {data.topServices.map((service, index) => {
                  const max = data.topServices[0]!.count;
                  return (
                    <li key={service.serviceId} className="text-sm">
                      <div className="mb-1 flex justify-between">
                        <span className="text-slate-800">
                          {index + 1}. {service.serviceName}
                        </span>
                        <span className="font-medium text-slate-900">{service.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100" aria-hidden="true">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${(service.count / max) * 100}%`,
                            background: SERIES_COLOR,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )
          ) : (
            <Skeleton className="h-64" />
          )}
        </section>

        <section
          className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2"
          aria-labelledby="ocupacion"
        >
          <h2 id="ocupacion" className="mb-1 font-semibold text-slate-900">
            Ocupación por profesional
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Minutos reservados sobre minutos laborables del rango
          </p>
          {data ? (
            data.occupancyByStaff.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">Sin profesionales activos</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.occupancyByStaff.map((s) => ({
                      ...s,
                      percent: Math.round(s.rate * 100),
                    }))}
                    layout="vertical"
                    margin={{ top: 4, right: 32, left: 8, bottom: 4 }}
                    barCategoryGap={8}
                  >
                    <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(value: number) => `${value} %`}
                      tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: GRID_COLOR }}
                    />
                    <YAxis
                      type="category"
                      dataKey="staffName"
                      width={110}
                      tick={{ fill: '#0f172a', fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      separator=": "
                      cursor={{ fill: '#f1f5f9' }}
                      formatter={(value, _name, item) => {
                        const row = item.payload as {
                          bookedMinutes: number;
                          workingMinutes: number;
                        };
                        return [
                          `${value} % (${row.bookedMinutes} de ${row.workingMinutes} min)`,
                          'Ocupación',
                        ];
                      }}
                    />
                    <Bar
                      dataKey="percent"
                      fill={SERIES_COLOR}
                      radius={[0, 4, 4, 0]}
                      barSize={18}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          ) : (
            <Skeleton className="h-56" />
          )}
        </section>

        <section
          className="rounded-xl border border-slate-200 bg-white p-4"
          aria-labelledby="estados"
        >
          <h2 id="estados" className="mb-4 font-semibold text-slate-900">
            Citas por estado
          </h2>
          {data ? (
            <dl className="grid grid-cols-2 gap-3">
              {(Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((status) => (
                <div key={status} className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">{STATUS_LABELS[status]}</dt>
                  <dd className="text-xl font-semibold text-slate-900">
                    {data.totalsByStatus[status]}
                  </dd>
                </div>
              ))}
              <div className="col-span-2 rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Ingresos del rango</dt>
                <dd className="text-xl font-semibold text-slate-900">
                  {formatPrice(data.revenue)}
                </dd>
              </div>
            </dl>
          ) : (
            <Skeleton className="h-40" />
          )}
        </section>
      </div>
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      {value === null ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
