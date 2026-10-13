import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSearch,
  ListChecks,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Timer,
} from 'lucide-react';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useTableState';
import {
  getSyncJobs,
  retrySyncJob,
  refreshSyncQueue,
  queueDocumentIndexing,
  getKnowledgeDocuments,
} from '@/services/knowledgeService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { FilterBar } from '@/components/common/FilterBar';
import { SearchInput, SelectField } from '@/components/common/Fields';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import { StatusBadge, DemoBadge } from '@/components/common/Badge';
import { StatCard } from '@/components/common/StatCard';
import { Drawer, Modal } from '@/components/common/Modal';
import { DemoNotice, Skeleton } from '@/components/common/States';
import { SOURCE_TYPES, SYNC_OPERATIONS, SYNC_STATUSES } from '@/utils/constants';
import { formatDateTime, formatRelative } from '@/utils/formatDate';

function sourceLink(job) {
  if (job.sourceType === 'listing' && job.sourceId.startsWith('lst')) return `/listings/${job.sourceId}`;
  if (job.sourceId.startsWith('doc')) return `/knowledge/${job.sourceId}`;
  return '/knowledge';
}

const NEXT_ACTION = {
  failed: 'Review the error, fix the source if needed, then retry.',
  pending: 'Waiting for the sync worker to pick this job up.',
  running: 'Processing — no action needed.',
  completed: 'None. The source is in sync.',
};

export default function KnowledgeSyncPage() {
  const { data: jobs = [], isPending, isError, error, refetch } = useApiQuery('syncJobs', getSyncJobs);
  const docs = useApiQuery('documents', getKnowledgeDocuments);
  const [openId, setOpenId] = useState(null);
  const [logJob, setLogJob] = useState(null);

  const config = useMemo(
    () => ({
      searchFields: (j) => [j.id, j.sourceTitle, j.sourceId],
      filters: {
        status: (j, v) => j.status === v,
        operation: (j, v) => j.operation === v,
        source: (j, v) => j.sourceType === v,
      },
      dateField: 'createdAt',
      sorters: { createdAt: (j) => new Date(j.createdAt).getTime(), retries: (j) => j.retryCount },
      defaultSort: { key: 'createdAt', dir: 'desc' },
    }),
    [],
  );
  const t = useTableState(jobs, config);

  const retry = useApiMutation((id) => retrySyncJob(id), {
    invalidate: [['syncJobs'], ['documents']],
    success: (j) => `Retry queued for ${j.id} (simulated)`,
    error: 'Couldn’t retry the job',
  });
  const refresh = useApiMutation(() => refreshSyncQueue(), {
    invalidate: [['syncJobs'], ['documents'], ['document'], ['listings']],
    success: (r) =>
      r.advanced ? `Simulated queue advanced ${r.advanced} job(s)` : 'Queue refreshed — nothing to process',
    error: 'Couldn’t refresh the queue',
  });
  const reindex = useApiMutation((docId) => queueDocumentIndexing(docId, 'reindex'), {
    invalidate: [['syncJobs'], ['documents']],
    success: (j) => `Reindex queued (${j.id})`,
    error: 'Couldn’t queue reindex',
  });

  const count = (s) => jobs.filter((j) => j.status === s).length;
  const lastOk = jobs
    .filter((j) => j.status === 'completed')
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
  const awaiting = (docs.data ?? []).filter((d) =>
    ['pending', 'processing', 'failed'].includes(d.indexingStatus),
  ).length;
  const open = jobs.find((j) => j.id === openId) ?? null;
  const canReindex = (j) =>
    j.sourceId.startsWith('doc') &&
    (docs.data ?? []).some((d) => d.id === j.sourceId && d.status === 'published' && d.includeInChatbot);

  const menu = (j) =>
    [
      { label: 'View details', icon: FileSearch, onSelect: () => setOpenId(j.id) },
      { label: 'View source', icon: ListChecks, to: sourceLink(j) },
      { label: 'View mock log', icon: ScrollText, onSelect: () => setLogJob(j) },
      j.status === 'failed' && {
        label: 'Retry job',
        icon: RotateCcw,
        onSelect: () => retry.mutate(j.id),
        separatorBefore: true,
      },
      canReindex(j) &&
        j.status === 'completed' && {
          label: 'Reindex source',
          icon: RefreshCw,
          onSelect: () => reindex.mutate(j.sourceId),
          separatorBefore: true,
        },
    ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Knowledge sync"
        description="Keeps published listings, FAQs and documents in step with the chatbot’s knowledge index."
        badge={<DemoBadge>Simulated</DemoBadge>}
        actions={
          <Button
            variant="outline"
            icon={RefreshCw}
            loading={refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            Refresh queue
          </Button>
        }
      />
      <DemoNotice className="mb-5" title="Simulated queue">
        No indexing actually happens here. “Refresh queue” advances demo jobs one step (pending → running →
        completed) so you can try the interface. Real job status will come from the Node.js sync worker.
      </DemoNotice>

      <section
        aria-label="Sync metrics"
        className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
      >
        {isPending ? (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[112px] rounded-card" />)
        ) : (
          <>
            <StatCard label="Total jobs" value={jobs.length} icon={ListChecks} sample />
            <StatCard
              label="Completed"
              value={count('completed')}
              icon={CheckCircle2}
              tone="success"
              to="/knowledge/sync?status=completed"
            />
            <StatCard
              label="Pending / running"
              value={count('pending') + count('running')}
              icon={Clock}
              tone="warning"
              to="/knowledge/sync?status=pending"
            />
            <StatCard
              label="Failed"
              value={count('failed')}
              icon={AlertTriangle}
              tone="danger"
              to="/knowledge/sync?status=failed"
            />
            <StatCard
              label="Last successful sync"
              value={lastOk ? formatRelative(lastOk.completedAt) : '—'}
              icon={Timer}
              tone="info"
            />
            <StatCard
              label="Documents awaiting sync"
              value={awaiting}
              icon={RefreshCw}
              tone="navy"
              to="/knowledge?indexing=pending"
            />
          </>
        )}
      </section>

      <Card padded={false}>
        <FilterBar
          chips={[
            t.q && { key: 'q', label: `Search: “${t.q}”`, onRemove: () => t.setQ('') },
            t.filterValues.status && {
              key: 's',
              label: SYNC_STATUSES[t.filterValues.status].label,
              onRemove: () => t.setFilter('status', ''),
            },
            t.filterValues.operation && {
              key: 'o',
              label: SYNC_OPERATIONS[t.filterValues.operation],
              onRemove: () => t.setFilter('operation', ''),
            },
            t.filterValues.source && {
              key: 't',
              label: SOURCE_TYPES[t.filterValues.source],
              onRemove: () => t.setFilter('source', ''),
            },
            (t.dateFrom || t.dateTo) && {
              key: 'd',
              label: 'Created date',
              onRemove: () => t.setDateRange('', ''),
            },
          ].filter(Boolean)}
          onReset={t.resetAll}
        >
          <SearchInput
            value={t.q}
            onChange={t.setQ}
            label="Search jobs"
            placeholder="Job ID or source"
            className="lg:w-60"
          />
          <SelectField
            label="Status"
            placeholder="All"
            options={Object.entries(SYNC_STATUSES).map(([k, s]) => ({ value: k, label: s.label }))}
            value={t.filterValues.status}
            onValueChange={(v) => t.setFilter('status', v)}
          />
          <SelectField
            label="Operation"
            placeholder="All"
            options={Object.entries(SYNC_OPERATIONS).map(([k, l]) => ({ value: k, label: l }))}
            value={t.filterValues.operation}
            onValueChange={(v) => t.setFilter('operation', v)}
          />
          <SelectField
            label="Source type"
            placeholder="All"
            options={Object.entries(SOURCE_TYPES).map(([k, l]) => ({ value: k, label: l }))}
            value={t.filterValues.source}
            onValueChange={(v) => t.setFilter('source', v)}
          />
          <DateRangePicker label="Created" from={t.dateFrom} to={t.dateTo} onChange={t.setDateRange} />
        </FilterBar>
        <DataTable
          caption="Sync jobs"
          loading={isPending}
          error={isError ? error : null}
          onRetry={refetch}
          rows={t.pageItems}
          rowLabel={(j) => j.id}
          sort={{ key: t.sortKey, dir: t.sortDir, onSort: t.setSort }}
          empty={{
            icon: ListChecks,
            title: jobs.length ? 'No jobs match your filters' : 'The queue is empty',
          }}
          rowClassName={(j) => (j.status === 'failed' ? 'bg-danger/[0.03]' : '')}
          columns={[
            {
              key: 'id',
              header: 'Job',
              cell: (j) => (
                <button
                  type="button"
                  onClick={() => setOpenId(j.id)}
                  className="font-mono text-xs font-semibold text-ink hover:text-accent-600"
                >
                  {j.id}
                </button>
              ),
            },
            {
              key: 'source',
              header: 'Source document',
              cell: (j) => (
                <Link
                  to={sourceLink(j)}
                  className="block max-w-[16rem] truncate font-medium text-ink hover:text-accent-600"
                >
                  {j.sourceTitle}
                </Link>
              ),
            },
            {
              key: 'type',
              header: 'Source type',
              hideBelow: 'lg',
              cell: (j) => <span className="whitespace-nowrap text-muted">{SOURCE_TYPES[j.sourceType]}</span>,
            },
            {
              key: 'op',
              header: 'Operation',
              hideBelow: 'md',
              cell: (j) => <span className="whitespace-nowrap">{SYNC_OPERATIONS[j.operation]}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              cell: (j) => <StatusBadge status={j.status} map={SYNC_STATUSES} />,
            },
            {
              key: 'created',
              header: 'Created',
              sortKey: 'createdAt',
              hideBelow: 'sm',
              cell: (j) => (
                <span className="whitespace-nowrap text-muted">{formatRelative(j.createdAt)}</span>
              ),
            },
            {
              key: 'completed',
              header: 'Completed',
              hideBelow: 'xl',
              cell: (j) => (
                <span className="whitespace-nowrap text-muted">
                  {j.completedAt ? formatRelative(j.completedAt) : '—'}
                </span>
              ),
            },
            {
              key: 'retries',
              header: 'Retries',
              sortKey: 'retries',
              align: 'right',
              hideBelow: 'lg',
              cell: (j) => j.retryCount,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (j) => (
                <DropdownMenu
                  label={`Actions for ${j.id}`}
                  items={menu(j)}
                  trigger={<IconButton label={`Actions for ${j.id}`} icon={MoreHorizontal} tooltip={false} />}
                />
              ),
            },
          ]}
        />
        <Pagination
          page={t.page}
          pageCount={t.pageCount}
          total={t.total}
          from={t.from}
          to={t.to}
          onPageChange={t.setPage}
          label="jobs"
        />
      </Card>

      <Drawer
        open={Boolean(open)}
        onOpenChange={(o) => !o && setOpenId(null)}
        title={open ? `Job ${open.id}` : ''}
        description={open ? SYNC_OPERATIONS[open.operation] : ''}
        footer={
          open && (
            <>
              <Button variant="outline" to={sourceLink(open)}>
                View source
              </Button>
              {open.status === 'failed' && (
                <Button icon={RotateCcw} loading={retry.isPending} onClick={() => retry.mutate(open.id)}>
                  Retry job
                </Button>
              )}
            </>
          )
        }
      >
        {open && (
          <div className="space-y-5 text-sm">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted">Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={open.status} map={SYNC_STATUSES} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Attempts</dt>
                <dd className="mt-1">{open.retryCount + 1}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Created (simulated)</dt>
                <dd className="mt-1">{formatDateTime(open.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Completed (simulated)</dt>
                <dd className="mt-1">{open.completedAt ? formatDateTime(open.completedAt) : '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted">Source record</dt>
                <dd className="mt-1">
                  <Link to={sourceLink(open)} className="font-medium text-accent-600 hover:underline">
                    {open.sourceTitle}
                  </Link>{' '}
                  <span className="text-muted">
                    ({SOURCE_TYPES[open.sourceType]} · {open.sourceId})
                  </span>
                </dd>
              </div>
            </dl>
            {open.errorSummary && (
              <div className="rounded-xl border border-danger/30 bg-danger/5 p-3">
                <p className="text-xs font-semibold text-danger">Error summary</p>
                <p className="mt-1 text-ink">{open.errorSummary}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-muted">Next action</p>
              <p className="mt-1">{NEXT_ACTION[open.status]}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-muted">Mock log</p>
              <ol className="space-y-1 rounded-xl bg-subtle/60 p-3 font-mono text-xs">
                {open.log.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={Boolean(logJob)}
        onOpenChange={(o) => !o && setLogJob(null)}
        title={logJob ? `Mock log — ${logJob.id}` : ''}
        description="Illustrative log lines, not real worker output."
        size="sm"
      >
        {logJob && (
          <ol className="space-y-1 rounded-xl bg-subtle/60 p-3 font-mono text-xs">
            {logJob.log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
        )}
      </Modal>
    </>
  );
}
