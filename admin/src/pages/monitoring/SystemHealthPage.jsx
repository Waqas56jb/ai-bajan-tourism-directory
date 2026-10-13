import { Link } from 'react-router-dom';
import { IS_DEMO } from '@/config/environment';
import {
  Activity,
  ArrowRight,
  Bot,
  Cloud,
  Database,
  FileCog,
  Globe,
  LayoutDashboard,
  PlugZap,
  RefreshCw,
  Server,
} from 'lucide-react';
import { useApiQuery } from '@/hooks/useApi';
import { getSystemHealth } from '@/services/monitoringService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge, DemoBadge } from '@/components/common/Badge';
import { ErrorState, PageLoading } from '@/components/common/States';
import { BarChartCard } from '@/components/charts/Charts';
import { SERVICES } from '@/utils/constants';
import { formatDate, formatRelative } from '@/utils/formatDate';

const ICONS = {
  public_site: Globe,
  admin: LayoutDashboard,
  api: Server,
  supabase: Database,
  openai: Cloud,
  rag: Bot,
  sync: RefreshCw,
  files: FileCog,
};
const SAMPLE = {
  operational: { label: IS_DEMO ? 'Sample: operational' : 'Operational', tone: 'success' },
  degraded: { label: IS_DEMO ? 'Sample: degraded' : 'Needs attention', tone: 'warning' },
  outage: { label: IS_DEMO ? 'Sample: outage' : 'Down', tone: 'danger' },
};

export default function SystemHealthPage() {
  const { data, isPending, isError, error, refetch } = useApiQuery('systemHealth', getSystemHealth);

  return (
    <>
      <PageHeader
        title="System health"
        description="Status of the services behind AI Bajan."
        badge={
          <Badge tone="muted" icon={PlugZap}>
            Not connected
          </Badge>
        }
      />
      <div className="mb-6 flex gap-3 rounded-card border border-info/30 bg-info/5 p-4 text-sm" role="note">
        <Activity className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
        <p className="text-ink">
          <strong>No live health checks are performed.</strong> This frontend-only build doesn’t contact any
          service, so nothing here means a service is online. Cards show labelled sample states to demonstrate
          the layout; real status will come from a backend health endpoint.
        </p>
      </div>
      {isError ? (
        <Card>
          <ErrorState message={error?.message} onRetry={refetch} />
        </Card>
      ) : isPending ? (
        <PageLoading />
      ) : (
        <>
          <section aria-label="Services" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.services.map((s) => {
              const Icon = ICONS[s.id];
              return (
                <Card key={s.id} className="flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-subtle text-ink">
                      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <Badge tone="muted" dot>
                      Not connected
                    </Badge>
                  </div>
                  <h2 className="mt-3 text-sm font-semibold">{SERVICES[s.id]}</h2>
                  <p className="mt-1 flex-1 text-xs text-muted">{s.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone={SAMPLE[s.demoStatus].tone}>{SAMPLE[s.demoStatus].label}</Badge>
                  </div>
                  <p className="mt-2 text-2xs text-muted">
                    Last checked: {s.lastCheckedAt ? formatRelative(s.lastCheckedAt) : 'never (no backend)'}
                  </p>
                  {s.incidents.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs">
                      {s.incidents.map((i) => (
                        <li key={i.id} className="text-muted">
                          <span className="font-medium text-ink">{formatRelative(i.at)}:</span> {i.text}
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    to={s.link}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent-600 hover:underline"
                  >
                    Related page <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </Card>
              );
            })}
          </section>
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <BarChartCard
              title="Incident history (14 days)"
              description="Sample incidents per day"
              sample
              xKey="label"
              height={240}
              data={data.history.map((h) => ({
                label: formatDate(h.date, { year: undefined }),
                incidents: h.incidents,
              }))}
              series={[{ key: 'incidents', name: 'Incidents' }]}
            />
            <Card>
              <CardHeader title="Connecting real monitoring" badge={<DemoBadge>Future</DemoBadge>} />
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
                <li>
                  Expose a <code className="text-ink">GET /health</code> endpoint from the Node.js API that
                  checks Supabase, OpenAI and the sync worker server-side.
                </li>
                <li>
                  Replace <code className="text-ink">getSystemHealth()</code> in{' '}
                  <code className="text-ink">services/monitoringService.js</code> with a call to that
                  endpoint.
                </li>
                <li>
                  Cards will show real status and “last checked” times; keys and connection strings stay on
                  the server.
                </li>
              </ol>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
