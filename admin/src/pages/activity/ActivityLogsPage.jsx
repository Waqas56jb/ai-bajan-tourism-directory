import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useApiQuery } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useTableState';
import { getActivityLogs } from '@/services/activityService';
import { ACTIVITY_ACTIONS } from '@/data/mockActivity';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { FilterBar } from '@/components/common/FilterBar';
import { SearchInput, SelectField } from '@/components/common/Fields';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { Badge } from '@/components/common/Badge';
import { Avatar } from '@/components/common/Avatar';
import { Drawer } from '@/components/common/Modal';
import { DemoNotice } from '@/components/common/States';
import { formatDateTime, formatRelative, toInputDate } from '@/utils/formatDate';
import { exportCSV } from '@/utils/csv';

const ENTITY_LINKS = {
  listing: (id) => (id?.includes(',') ? '/listings' : `/listings/${id}`),
  document: (id) => `/knowledge/${id}`,
  faq: (id) => `/knowledge/faqs?edit=${id}`,
  advertisement: () => '/advertising',
  featured: () => '/advertising/featured',
  admin: () => '/administrators',
  user: (id) => `/users/${id}`,
  sync_job: () => '/knowledge/sync',
  settings: (id) => (id === 'chatbot' ? '/chatbot/settings' : '/settings/general'),
  category: () => '/categories',
  location: () => '/locations',
};

export default function ActivityLogsPage() {
  const { data: logs = [], isPending, isError, error, refetch } = useApiQuery('activity', getActivityLogs);
  const [open, setOpen] = useState(null);
  const actors = useMemo(() => [...new Set(logs.map((l) => l.actor))].sort(), [logs]);

  const config = useMemo(
    () => ({
      searchFields: (e) => [e.actor, e.entityName, e.summary, ACTIVITY_ACTIONS[e.action]],
      filters: {
        action: (e, v) => e.action === v,
        actor: (e, v) => e.actor === v,
        entity: (e, v) => e.entityType === v,
      },
      dateField: 'at',
      sorters: {
        at: (e) => new Date(e.at).getTime(),
        actor: (e) => e.actor,
        action: (e) => ACTIVITY_ACTIONS[e.action] ?? e.action,
      },
      defaultSort: { key: 'at', dir: 'desc' },
      pageSize: 15,
    }),
    [],
  );
  const t = useTableState(logs, config);

  const exportRows = () => {
    exportCSV(`ai-bajan-activity-${toInputDate(new Date())}.csv`, t.filtered, [
      { label: 'Timestamp', value: 'at' },
      { label: 'Actor', value: 'actor' },
      { label: 'Action', value: (e) => ACTIVITY_ACTIONS[e.action] ?? e.action },
      { label: 'Entity type', value: 'entityType' },
      { label: 'Entity', value: 'entityName' },
      { label: 'Summary', value: 'summary' },
      { label: 'Status', value: 'status' },
    ]);
    toast.success(`Exported ${t.filtered.length} log entries`);
  };

  return (
    <>
      <PageHeader
        title="Activity logs"
        description="Changes made across the platform."
        actions={
          <Button variant="outline" icon={Download} onClick={exportRows} disabled={!t.filtered.length}>
            Export CSV
          </Button>
        }
      />
      <DemoNotice className="mb-5" title="Not an audit trail">
        These entries are stored in this browser for the demo and can be reset. A tamper-resistant audit log
        must be recorded by the backend.
      </DemoNotice>
      <Card padded={false}>
        <FilterBar
          chips={[
            t.q && { key: 'q', label: `Search: “${t.q}”`, onRemove: () => t.setQ('') },
            t.filterValues.action && {
              key: 'a',
              label: ACTIVITY_ACTIONS[t.filterValues.action],
              onRemove: () => t.setFilter('action', ''),
            },
            t.filterValues.actor && {
              key: 'r',
              label: `By ${t.filterValues.actor}`,
              onRemove: () => t.setFilter('actor', ''),
            },
            t.filterValues.entity && {
              key: 'e',
              label: t.filterValues.entity,
              onRemove: () => t.setFilter('entity', ''),
            },
            (t.dateFrom || t.dateTo) && {
              key: 'd',
              label: 'Date range',
              onRemove: () => t.setDateRange('', ''),
            },
          ].filter(Boolean)}
          onReset={t.resetAll}
        >
          <SearchInput
            value={t.q}
            onChange={t.setQ}
            label="Search activity"
            placeholder="Actor, entity or summary"
            className="lg:w-64"
          />
          <SelectField
            label="Action"
            placeholder="All actions"
            options={Object.entries(ACTIVITY_ACTIONS).map(([k, l]) => ({ value: k, label: l }))}
            value={t.filterValues.action}
            onValueChange={(v) => t.setFilter('action', v)}
          />
          <SelectField
            label="Actor"
            placeholder="Anyone"
            options={actors}
            value={t.filterValues.actor}
            onValueChange={(v) => t.setFilter('actor', v)}
          />
          <SelectField
            label="Entity"
            placeholder="All"
            options={Object.keys(ENTITY_LINKS)}
            value={t.filterValues.entity}
            onValueChange={(v) => t.setFilter('entity', v)}
          />
          <DateRangePicker label="Date" from={t.dateFrom} to={t.dateTo} onChange={t.setDateRange} />
        </FilterBar>
        <DataTable
          caption="Activity log"
          loading={isPending}
          error={isError ? error : null}
          onRetry={refetch}
          rows={t.pageItems}
          rowLabel={(e) => e.id}
          sort={{ key: t.sortKey, dir: t.sortDir, onSort: t.setSort }}
          empty={{ icon: Activity, title: 'No activity matches your filters' }}
          columns={[
            {
              key: 'at',
              header: 'Time',
              sortKey: 'at',
              cell: (e) => (
                <button type="button" onClick={() => setOpen(e)} className="whitespace-nowrap text-left">
                  <span className="block text-ink">{formatRelative(e.at)}</span>
                  <span className="block text-2xs text-muted">{formatDateTime(e.at)}</span>
                </button>
              ),
            },
            {
              key: 'actor',
              header: 'Actor',
              sortKey: 'actor',
              hideBelow: 'md',
              cell: (e) => (
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <Avatar name={e.actor} size="xs" />
                  {e.actor}
                </span>
              ),
            },
            {
              key: 'action',
              header: 'Action',
              sortKey: 'action',
              cell: (e) => (
                <span className="whitespace-nowrap font-medium">
                  {ACTIVITY_ACTIONS[e.action] ?? e.action}
                </span>
              ),
            },
            {
              key: 'entity',
              header: 'Entity',
              hideBelow: 'lg',
              cell: (e) => (
                <Link
                  to={(ENTITY_LINKS[e.entityType] ?? (() => '/'))(e.entityId)}
                  className="block max-w-[14rem] truncate text-accent-600 hover:underline"
                >
                  {e.entityName}
                </Link>
              ),
            },
            {
              key: 'summary',
              header: 'Summary',
              hideBelow: 'xl',
              cell: (e) => <p className="max-w-sm truncate text-muted">{e.summary}</p>,
            },
            {
              key: 'status',
              header: 'Status',
              cell: (e) => (
                <Badge tone={e.status === 'failed' ? 'danger' : 'success'} dot>
                  {e.status === 'failed' ? 'Failed' : 'Success'}
                </Badge>
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
          pageSize={t.pageSize}
          onPageSizeChange={t.setPageSize}
          label="entries"
        />
      </Card>
      <Drawer
        open={Boolean(open)}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open ? (ACTIVITY_ACTIONS[open.action] ?? open.action) : ''}
        description={open ? formatDateTime(open.at) : ''}
      >
        {open && (
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs text-muted">Actor</dt>
              <dd className="mt-1 flex items-center gap-2">
                <Avatar name={open.actor} size="xs" />
                {open.actor}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Entity</dt>
              <dd className="mt-1">
                <Link
                  to={(ENTITY_LINKS[open.entityType] ?? (() => '/'))(open.entityId)}
                  className="text-accent-600 hover:underline"
                >
                  {open.entityName}
                </Link>{' '}
                <span className="text-muted">({open.entityType})</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Summary</dt>
              <dd className="mt-1">{open.summary}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Status</dt>
              <dd className="mt-1">{open.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Event ID</dt>
              <dd className="mt-1 font-mono text-xs">{open.id}</dd>
            </div>
          </dl>
        )}
      </Drawer>
    </>
  );
}
