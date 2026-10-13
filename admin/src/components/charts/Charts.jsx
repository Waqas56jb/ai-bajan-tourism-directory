/**
 * Chart cards built on Recharts. Each chart has an accessible text summary (sr-only) because
 * SVG charts aren't readable by screen readers.
 */
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardHeader } from '@/components/common/Card';
import { DemoBadge } from '@/components/common/Badge';
import { EmptyState, Skeleton } from '@/components/common/States';
import { formatCompact, formatNumber } from '@/utils/formatNumber';
import { useChartColors } from './useChartColors';

const shortDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function ChartTooltip({ active, payload, label, labelFormatter = shortDate }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-semibold text-ink">{labelFormatter(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden="true" />
          {p.name}: <span className="font-semibold text-ink tabular">{formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function ChartShell({
  title,
  description,
  sample,
  actions,
  loading,
  empty,
  summary,
  children,
  height = 260,
  className = '',
}) {
  return (
    <Card className={className}>
      <CardHeader
        title={title}
        description={description}
        badge={sample ? <DemoBadge>Sample</DemoBadge> : null}
        actions={actions}
      />
      {loading ? (
        <div className="skeleton w-full" style={{ height }} aria-hidden="true" />
      ) : empty ? (
        <EmptyState compact title="No data for this period" />
      ) : (
        <figure>
          <div style={{ height }} aria-hidden="true">
            {children}
          </div>
          {summary && <figcaption className="sr-only">{summary}</figcaption>}
        </figure>
      )}
    </Card>
  );
}

/** Area/line over time. series: [{ key, name }] */
export function AreaChartCard({ data = [], series, xKey = 'date', variant = 'area', ...shell }) {
  const colors = useChartColors();
  const summary = series
    .map((s) => `${s.name}: ${formatNumber(data.reduce((a, d) => a + (d[s.key] ?? 0), 0))} total`)
    .join('; ');
  const Chart = variant === 'line' ? LineChart : AreaChart;
  return (
    <ChartShell
      {...shell}
      empty={!shell.loading && data.length === 0}
      summary={`${shell.title}. ${summary}.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color ?? colors.series[i]} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color ?? colors.series[i]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={colors.grid} vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis
            tickFormatter={formatCompact}
            tickLine={false}
            axisLine={false}
            width={44}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip />} />
          {series.length > 1 && (
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: colors.muted }} />
          )}
          {series.map((s, i) =>
            variant === 'line' ? (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color ?? colors.series[i]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ) : (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color ?? colors.series[i]}
                strokeWidth={2}
                fill={`url(#grad-${s.key})`}
              />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function LineChartCard(props) {
  return <AreaChartCard {...props} variant="line" />;
}

/** Bars by category. */
export function BarChartCard({ data = [], xKey, series, layout = 'vertical', ...shell }) {
  const colors = useChartColors();
  const horizontal = layout === 'horizontal';
  const summary = data
    .map(
      (d) =>
        `${d[xKey]}: ${series.map((s) => `${formatNumber(d[s.key])} ${s.name.toLowerCase()}`).join(', ')}`,
    )
    .join('; ');
  return (
    <ChartShell
      {...shell}
      empty={!shell.loading && data.length === 0}
      summary={`${shell.title}. ${summary}.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 12, bottom: 0, left: horizontal ? 8 : -12 }}
        >
          <CartesianGrid stroke={colors.grid} horizontal={!horizontal} vertical={horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tickFormatter={formatCompact} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey={xKey}
                tickLine={false}
                axisLine={false}
                width={130}
                tick={{ fontSize: 11 }}
              />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatCompact} tickLine={false} axisLine={false} width={44} />
            </>
          )}
          <Tooltip
            content={<ChartTooltip labelFormatter={(l) => l} />}
            cursor={{ fill: colors.grid, opacity: 0.4 }}
          />
          {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={s.color ?? colors.series[i]}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              maxBarSize={28}
              stackId={s.stack}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

/** Donut with a legend list (legend doubles as the accessible data table). */
export function DonutChartCard({
  data = [],
  nameKey = 'name',
  valueKey = 'value',
  colors: customColors,
  centerLabel = 'Total',
  ...shell
}) {
  const colors = useChartColors();
  const total = data.reduce((a, d) => a + d[valueKey], 0);
  const palette = customColors ?? colors.series;
  return (
    <Card className={shell.className}>
      <CardHeader
        title={shell.title}
        description={shell.description}
        badge={shell.sample ? <DemoBadge>Sample</DemoBadge> : null}
        actions={shell.actions}
      />
      {shell.loading ? (
        <Skeleton className="h-56 w-full" />
      ) : total === 0 ? (
        <EmptyState compact title="No data yet" />
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col">
          <div className="relative h-44 w-44 shrink-0" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey={valueKey}
                  nameKey={nameKey}
                  innerRadius="66%"
                  outerRadius="100%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((d, i) => (
                    <Cell key={d[nameKey]} fill={d.color ?? palette[i % palette.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip labelFormatter={() => ''} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold tabular text-ink">{formatNumber(total)}</span>
              <span className="text-2xs uppercase tracking-wide text-muted">{centerLabel}</span>
            </div>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-2" aria-label={`${shell.title} breakdown`}>
            {data.map((d, i) => (
              <li key={d[nameKey]} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: d.color ?? palette[i % palette.length] }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-muted">{d.label ?? d[nameKey]}</span>
                <span className="font-semibold tabular text-ink">{formatNumber(d[valueKey])}</span>
                <span className="w-10 text-right text-xs tabular text-muted">
                  {total ? Math.round((d[valueKey] / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
