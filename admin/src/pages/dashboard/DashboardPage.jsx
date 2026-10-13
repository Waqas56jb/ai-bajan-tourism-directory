import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FilePlus2,
  HelpCircle,
  Inbox,
  MessagesSquare,
  RefreshCw,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApiQuery } from '@/hooks/useApi';
import { useLookups } from '@/hooks/useLookups';
import { getDashboardStats } from '@/services/dashboardService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Card, CardHeader } from '@/components/common/Card';
import { StatCard } from '@/components/common/StatCard';
import { SelectField } from '@/components/common/Fields';
import { DataTable } from '@/components/common/DataTable';
import { DemoBadge } from '@/components/common/Badge';
import { ErrorState, Skeleton } from '@/components/common/States';
import { AreaChartCard, BarChartCard, DonutChartCard, LineChartCard } from '@/components/charts/Charts';
import { ListingStatusBadge, ListingThumb } from '@/components/listings/ListingStatusBadge';
import { LISTING_STATUSES } from '@/utils/constants';
import { ACTIVITY_ACTIONS } from '@/data/mockActivity';
import { formatNumber, formatPercent, formatMs, percentChange } from '@/utils/formatNumber';
import { formatDate, formatRelative, toInputDate } from '@/utils/formatDate';
import { exportCSV } from '@/utils/csv';
import { useChartColors } from '@/components/charts/useChartColors';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const QUICK_ACTIONS = [
  { label: 'Add listing', to: '/listings/new', icon: FilePlus2 },
  { label: 'Review submissions', to: '/listings/submissions', icon: Inbox },
  { label: 'Add knowledge document', to: '/knowledge/new', icon: BookOpen },
  { label: 'Manage FAQs', to: '/knowledge/faqs', icon: HelpCircle },
  { label: 'Review conversations', to: '/chatbot/conversations', icon: MessagesSquare },
  { label: 'Manage featured listings', to: '/advertising/featured', icon: Star },
];

export default function DashboardPage() {
  const [days, setDays] = useState('30');
  const { data, isPending, isError, error, refetch, isFetching } = useApiQuery(['dashboard', days], () =>
    getDashboardStats({ days: Number(days) }),
  );
  const { categoryName, placeLabel } = useLookups();
  const colors = useChartColors();

  const refresh = async () => {
    const res = await refetch();
    if (res.isError) toast.error('Couldn’t refresh the dashboard', { description: res.error?.message });
    else toast.success('Dashboard refreshed', { description: 'Reloaded from the demo data service.' });
  };

  const exportReport = () => {
    if (!data) return;
    const k = data.kpis;
    const rows = [
      { metric: 'Total listings', value: k.totalListings.value },
      { metric: 'Published listings', value: k.publishedListings.value },
      { metric: 'Pending approvals', value: k.pendingApprovals.value },
      { metric: `Chatbot conversations (last ${days} days, sample)`, value: k.conversations.value },
      { metric: 'Knowledge documents', value: k.knowledgeDocuments.value },
      { metric: 'Active featured listings', value: k.activeFeatured.value },
    ];
    exportCSV(`ai-bajan-dashboard-${toInputDate(new Date())}.csv`, rows, [
      { label: 'Metric', value: 'metric' },
      { label: 'Value', value: 'value' },
    ]);
    toast.success('Report exported', { description: 'CSV of the current dashboard figures (demo data).' });
  };

  const header = (
    <PageHeader
      title="Dashboard"
      description="Overview of your directory, AI assistant, and platform activity."
      actions={
        <>
          <SelectField
            label="Date range"
            hideLabel
            options={RANGES}
            value={days}
            onValueChange={setDays}
            className="w-40"
          />
          <Button variant="outline" icon={RefreshCw} onClick={refresh} loading={isFetching && !isPending}>
            Refresh
          </Button>
          <Button variant="outline" icon={Download} onClick={exportReport} disabled={!data}>
            Export
          </Button>
        </>
      }
    />
  );

  if (isError) {
    return (
      <>
        {header}
        <Card>
          <ErrorState message={error?.message} onRetry={refetch} retrying={isFetching} />
        </Card>
      </>
    );
  }

  const k = data?.kpis;
  const cb = data?.chatbot;

  return (
    <>
      {header}

      {/* KPIs */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
      >
        {isPending
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[118px] rounded-card" />)
          : [
              <StatCard
                key="t"
                label="Total listings"
                value={k.totalListings.value}
                icon={Building2}
                hint={`${k.totalListings.created} new this period`}
                to="/listings"
              />,
              <StatCard
                key="p"
                label="Published listings"
                value={k.publishedListings.value}
                icon={CheckCircle2}
                tone="success"
                hint={`${formatPercent(k.publishedListings.share)} of all listings`}
                to="/listings?status=published"
              />,
              <StatCard
                key="a"
                label="Pending approvals"
                value={k.pendingApprovals.value}
                icon={Clock}
                tone="warning"
                hint={k.pendingApprovals.value ? 'Waiting for review' : 'Queue is clear'}
                to="/listings/submissions"
              />,
              <StatCard
                key="c"
                label="Chatbot conversations"
                value={k.conversations.value}
                icon={MessagesSquare}
                tone="navy"
                change={percentChange(k.conversations.value, k.conversations.previous)}
                sample
                to="/chatbot"
              />,
              <StatCard
                key="d"
                label="Knowledge documents"
                value={k.knowledgeDocuments.value}
                icon={BookOpen}
                tone="info"
                hint={`${k.knowledgeDocuments.indexed} indexed (simulated)`}
                to="/knowledge"
              />,
              <StatCard
                key="f"
                label="Active featured listings"
                value={k.activeFeatured.value}
                icon={Star}
                tone="sand"
                hint={`${k.activeFeatured.scheduled} scheduled`}
                to="/advertising/featured"
              />,
            ]}
      </section>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <AreaChartCard
          className="xl:col-span-2"
          title="Listing growth"
          description="Total listings over the selected period, from listing creation dates."
          loading={isPending}
          data={data?.listingGrowth ?? []}
          series={[{ key: 'total', name: 'Total listings' }]}
        />
        <DonutChartCard
          title="Listing distribution"
          description="Listings by status"
          loading={isPending}
          centerLabel="Listings"
          data={(data?.distribution ?? []).map((d, i) => ({
            name: d.status,
            label: LISTING_STATUSES[d.status].label,
            value: d.value,
            color: [colors.success, colors.warning, colors.series[5], colors.danger, colors.series[1]][i],
          }))}
        />
        <LineChartCard
          className="xl:col-span-2"
          title="Chatbot activity"
          description="Conversations and fallback responses"
          sample
          loading={isPending}
          data={data?.chatbotActivity ?? []}
          series={[
            { key: 'conversations', name: 'Conversations' },
            { key: 'fallback', name: 'Fallback responses', color: colors.warning },
          ]}
        />
        <Card>
          <CardHeader
            title="Chatbot performance"
            description={`Last ${days} days`}
            badge={<DemoBadge>Sample</DemoBadge>}
            actions={
              <Link to="/chatbot" className="text-xs font-medium text-accent-600 hover:underline">
                Details
              </Link>
            }
          />
          {isPending ? (
            <Skeleton className="h-48" />
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              {[
                ['Conversations', formatNumber(cb.conversations)],
                ['Questions answered', formatNumber(cb.answered)],
                [
                  'Fallback responses',
                  `${formatNumber(cb.fallback)} (${formatPercent(cb.fallback / cb.conversations)})`,
                ],
                ['Helpful ratings', formatPercent(cb.positive / Math.max(1, cb.positive + cb.negative))],
                ['Unhelpful ratings', formatNumber(cb.negative)],
                ['Avg. response time', formatMs(cb.latencyMs)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="mt-0.5 text-base font-semibold tabular text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-4 text-2xs text-muted">
            Illustrative values — real metrics will come from the chatbot backend.
          </p>
        </Card>
        <BarChartCard
          className="xl:col-span-2"
          title="Popular categories"
          description="Category page visits in the period"
          sample
          loading={isPending}
          layout="horizontal"
          height={280}
          xKey="name"
          data={data?.popularCategories ?? []}
          series={[{ key: 'visits', name: 'Visits' }]}
        />
        <Card>
          <CardHeader title="Quick actions" />
          <ul className="grid gap-2">
            {QUICK_ACTIONS.map((a) => (
              <li key={a.to}>
                <Link
                  to={a.to}
                  className="group flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm font-medium transition-colors hover:border-accent/40 hover:bg-accent-50/50"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent-600">
                    <a.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="flex-1">{a.label}</span>
                  <ArrowRight
                    className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card padded={false} className="xl:col-span-2">
          <div className="p-5 pb-0">
            <CardHeader
              title="Top listings"
              description="Most viewed published listings (sample view counts)"
              actions={
                <Button to="/listings" variant="ghost" size="sm" iconRight={ArrowRight}>
                  All listings
                </Button>
              }
            />
          </div>
          <DataTable
            caption="Top listings"
            loading={isPending}
            rows={data?.topListings ?? []}
            skeletonRows={5}
            columns={[
              {
                key: 'name',
                header: 'Listing',
                cell: (l) => (
                  <Link
                    to={`/listings/${l.id}`}
                    className="flex items-center gap-3 font-medium text-ink hover:text-accent-600"
                  >
                    <ListingThumb listing={l} size="h-9 w-12" />
                    <span className="min-w-0">
                      <span className="block truncate">{l.name}</span>
                      <span className="block truncate text-xs font-normal text-muted">
                        {placeLabel(l.location)}
                      </span>
                    </span>
                  </Link>
                ),
              },
              {
                key: 'category',
                header: 'Category',
                hideBelow: 'md',
                cell: (l) => (
                  <span className="whitespace-nowrap text-muted">{categoryName(l.categoryId)}</span>
                ),
              },
              { key: 'status', header: 'Status', cell: (l) => <ListingStatusBadge status={l.status} /> },
              { key: 'views', header: 'Views', align: 'right', cell: (l) => formatNumber(l.views) },
              {
                key: 'updated',
                header: 'Updated',
                hideBelow: 'xl',
                cell: (l) => <span className="whitespace-nowrap text-muted">{formatDate(l.updatedAt)}</span>,
              },
            ]}
          />
        </Card>
        <Card>
          <CardHeader
            title="Recent activity"
            actions={
              <Link to="/activity" className="text-xs font-medium text-accent-600 hover:underline">
                View all
              </Link>
            }
          />
          {isPending ? (
            <Skeleton className="h-64" />
          ) : (
            <ol className="relative space-y-4 border-l border-line pl-4">
              {data.recentActivity.map((e) => (
                <li key={e.id} className="relative">
                  <span
                    className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-surface ${e.status === 'failed' ? 'bg-danger' : 'bg-accent'}`}
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-ink">{ACTIVITY_ACTIONS[e.action] ?? e.action}</p>
                  <p className="truncate text-xs text-muted">
                    {e.entityName} · {e.actor}
                  </p>
                  <p className="text-2xs text-muted">{formatRelative(e.at)}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
