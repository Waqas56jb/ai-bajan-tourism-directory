import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Gauge,
  MessageSquareWarning,
  MessagesSquare,
  RefreshCw,
  Settings,
  ThumbsUp,
  Timer,
} from 'lucide-react';
import { useApiQuery } from '@/hooks/useApi';
import { getChatbotStats, getConversations } from '@/services/chatbotService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { SelectField } from '@/components/common/Fields';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge, DemoBadge } from '@/components/common/Badge';
import { DataTable } from '@/components/common/DataTable';
import { DemoNotice, ErrorState, Skeleton } from '@/components/common/States';
import { AreaChartCard, BarChartCard, DonutChartCard } from '@/components/charts/Charts';
import { useChartColors } from '@/components/charts/useChartColors';
import { CONVERSATION_STATUSES } from '@/utils/constants';
import { formatMs, formatPercent, percentChange } from '@/utils/formatNumber';
import { formatRelative } from '@/utils/formatDate';
import { FeedbackIcon } from '@/components/chatbot/ConversationList';

export default function ChatbotOverviewPage() {
  const [days, setDays] = useState('30');
  const stats = useApiQuery(['chatbotStats', days], () => getChatbotStats(Number(days)));
  const convos = useApiQuery('conversations', getConversations);
  const colors = useChartColors();
  const s = stats.data;
  const c = s?.current;
  const p = s?.previous;

  return (
    <>
      <PageHeader
        title="AI assistant overview"
        description="How the chatbot is performing and what visitors ask about."
        badge={<DemoBadge>Sample metrics</DemoBadge>}
        actions={
          <SelectField
            label="Period"
            hideLabel
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
            value={days}
            onValueChange={setDays}
            className="w-40"
          />
        }
      />
      <DemoNotice className="mb-5" title="Sample data">
        These metrics are illustrative and not measured from a live assistant. They will be replaced by real
        analytics once the chatbot backend is connected.
      </DemoNotice>

      {stats.isError ? (
        <Card>
          <ErrorState message={stats.error?.message} onRetry={stats.refetch} />
        </Card>
      ) : (
        <>
          <section
            aria-label="Assistant metrics"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
          >
            {stats.isPending ? (
              Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[118px] rounded-card" />)
            ) : (
              <>
                <StatCard
                  label="Conversations"
                  value={c.conversations}
                  icon={MessagesSquare}
                  change={percentChange(c.conversations, p?.conversations)}
                  sample
                />
                <StatCard
                  label="Questions received"
                  value={c.questions}
                  icon={Gauge}
                  tone="navy"
                  change={percentChange(c.questions, p?.questions)}
                  sample
                />
                <StatCard
                  label="Answered"
                  value={c.answered}
                  icon={CheckCircle2}
                  tone="success"
                  hint={`${formatPercent(c.answered / c.conversations)} of conversations`}
                  sample
                />
                <StatCard
                  label="Fallback responses"
                  value={c.fallback}
                  icon={MessageSquareWarning}
                  tone="warning"
                  change={percentChange(c.fallback, p?.fallback)}
                  positiveIsGood={false}
                  sample
                />
                <StatCard
                  label="User satisfaction"
                  value={formatPercent(s.satisfaction)}
                  icon={ThumbsUp}
                  tone="sand"
                  hint="Share of helpful ratings"
                  sample
                />
                <StatCard
                  label="Avg. response latency"
                  value={formatMs(c.latencyMs)}
                  icon={Timer}
                  tone="info"
                  hint="Time to first answer"
                  sample
                />
              </>
            )}
          </section>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <AreaChartCard
              className="xl:col-span-2"
              title="Conversation volume"
              description="Conversations per day"
              sample
              loading={stats.isPending}
              data={s?.series ?? []}
              series={[{ key: 'conversations', name: 'Conversations' }]}
            />
            <DonutChartCard
              title="User feedback"
              sample
              loading={stats.isPending}
              centerLabel="Conversations"
              data={(s?.feedback ?? []).map((f, i) => ({
                ...f,
                color: [colors.success, colors.danger, colors.series[5]][i],
              }))}
            />
            <AreaChartCard
              className="xl:col-span-2"
              title="Answered vs fallback"
              description="Grounded answers compared with fallback responses"
              sample
              loading={stats.isPending}
              data={s?.series ?? []}
              series={[
                { key: 'answered', name: 'Answered' },
                { key: 'fallback', name: 'Fallback', color: colors.warning },
              ]}
            />
            <BarChartCard
              title="Questions by topic"
              sample
              loading={stats.isPending}
              layout="horizontal"
              xKey="topic"
              height={260}
              data={s?.topics ?? []}
              series={[{ key: 'count', name: 'Questions' }]}
            />
          </div>
        </>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card padded={false} className="xl:col-span-2">
          <div className="p-5 pb-0">
            <CardHeader
              title="Recent conversations"
              actions={
                <Button to="/chatbot/conversations" variant="ghost" size="sm" iconRight={ArrowRight}>
                  All conversations
                </Button>
              }
            />
          </div>
          <DataTable
            caption="Recent conversations"
            loading={convos.isPending}
            rows={(convos.data ?? []).slice(0, 6)}
            skeletonRows={5}
            rowLabel={(x) => x.id}
            columns={[
              {
                key: 'id',
                header: 'Conversation',
                cell: (x) => (
                  <Link
                    to={`/chatbot/conversations/${x.id}`}
                    className="font-mono text-xs font-semibold text-ink hover:text-accent-600"
                  >
                    {x.id}
                  </Link>
                ),
              },
              {
                key: 'started',
                header: 'Started',
                cell: (x) => (
                  <span className="whitespace-nowrap text-muted">{formatRelative(x.startedAt)}</span>
                ),
              },
              {
                key: 'messages',
                header: 'Messages',
                align: 'right',
                hideBelow: 'sm',
                cell: (x) => x.messageCount,
              },
              { key: 'topic', header: 'Topic', hideBelow: 'md', cell: (x) => x.topic },
              {
                key: 'status',
                header: 'Status',
                cell: (x) => <StatusBadge status={x.status} map={CONVERSATION_STATUSES} />,
              },
              {
                key: 'feedback',
                header: 'Feedback',
                hideBelow: 'sm',
                cell: (x) => <FeedbackIcon value={x.feedback} />,
              },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Quick actions" />
          <ul className="grid gap-2">
            {[
              { label: 'Review conversations', to: '/chatbot/conversations', icon: MessagesSquare },
              { label: 'Manage knowledge base', to: '/knowledge', icon: BookOpen },
              { label: 'Edit chatbot settings', to: '/chatbot/settings', icon: Settings },
              { label: 'Review sync failures', to: '/knowledge/sync?status=failed', icon: RefreshCw },
            ].map((a) => (
              <li key={a.to}>
                <Link
                  to={a.to}
                  className="group flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm font-medium hover:border-accent/40 hover:bg-accent-50/50"
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
    </>
  );
}
