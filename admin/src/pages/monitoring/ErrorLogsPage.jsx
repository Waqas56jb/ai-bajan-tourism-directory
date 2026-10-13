import { useMemo, useState } from 'react';
import { AlertOctagon, CheckCircle2, Copy, Download, Eye, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useTableState';
import { getErrorLogs, updateErrorLog } from '@/services/monitoringService';
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
import { StatusBadge, Badge, DemoBadge } from '@/components/common/Badge';
import { Drawer } from '@/components/common/Modal';
import { DemoNotice } from '@/components/common/States';
import { ERROR_CATEGORIES, SERVICES, SEVERITIES } from '@/utils/constants';
import { formatDateTime, formatRelative, toInputDate } from '@/utils/formatDate';
import { exportCSV } from '@/utils/csv';

const summary = (e) =>
  `[${e.severity.toUpperCase()}] ${formatDateTime(e.at)} ${SERVICES[e.service]} — ${ERROR_CATEGORIES[e.category]}: ${e.message} (ref ${e.reference})`;

export default function ErrorLogsPage() {
  const { data: logs = [], isPending, isError, error, refetch } = useApiQuery('errorLogs', getErrorLogs);
  const [openId, setOpenId] = useState(null);

  const config = useMemo(
    () => ({
      searchFields: (e) => [e.id, e.message, e.reference, ERROR_CATEGORIES[e.category]],
      filters: {
        severity: (e, v) => e.severity === v,
        service: (e, v) => e.service === v,
        category: (e, v) => e.category === v,
        status: (e, v) => e.status === v,
      },
      dateField: 'at',
      sorters: {
        at: (e) => new Date(e.at).getTime(),
        severity: (e) => Object.keys(SEVERITIES).indexOf(e.severity),
      },
      defaultSort: { key: 'at', dir: 'desc' },
    }),
    [],
  );
  const t = useTableState(logs, config);

  const review = useApiMutation((id) => updateErrorLog(id, { status: 'reviewed' }), {
    invalidate: [['errorLogs']],
    success: (e) => `${e.id} marked as reviewed`,
    error: 'Couldn’t update',
  });

  const copy = async (e) => {
    try {
      await navigator.clipboard.writeText(summary(e));
      toast.success('Error summary copied');
    } catch {
      toast.error('Couldn’t access the clipboard');
    }
  };

  const exportRows = () => {
    exportCSV(`ai-bajan-error-logs-${toInputDate(new Date())}.csv`, t.filtered, [
      { label: 'ID', value: 'id' },
      { label: 'Timestamp', value: 'at' },
      { label: 'Severity', value: 'severity' },
      { label: 'Service', value: (e) => SERVICES[e.service] },
      { label: 'Category', value: (e) => ERROR_CATEGORIES[e.category] },
      { label: 'Message', value: 'message' },
      { label: 'Reference', value: 'reference' },
      { label: 'Status', value: 'status' },
    ]);
    toast.success(`Exported ${t.filtered.length} sample log entries`);
  };

  const open = logs.find((e) => e.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Error logs"
        description="Errors reported by platform services."
        badge={<DemoBadge>Mock data</DemoBadge>}
        actions={
          <Button variant="outline" icon={Download} onClick={exportRows} disabled={!t.filtered.length}>
            Export CSV
          </Button>
        }
      />
      <DemoNotice className="mb-5" title="Sample records">
        All entries are mock data. Real logs must never contain credentials, API keys, secrets or private user
        data.
      </DemoNotice>
      <Card padded={false}>
        <FilterBar
          chips={[
            t.q && { key: 'q', label: `Search: “${t.q}”`, onRemove: () => t.setQ('') },
            t.filterValues.severity && {
              key: 's',
              label: SEVERITIES[t.filterValues.severity].label,
              onRemove: () => t.setFilter('severity', ''),
            },
            t.filterValues.service && {
              key: 'v',
              label: SERVICES[t.filterValues.service],
              onRemove: () => t.setFilter('service', ''),
            },
            t.filterValues.category && {
              key: 'c',
              label: ERROR_CATEGORIES[t.filterValues.category],
              onRemove: () => t.setFilter('category', ''),
            },
            t.filterValues.status && {
              key: 'st',
              label: t.filterValues.status,
              onRemove: () => t.setFilter('status', ''),
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
            label="Search error logs"
            placeholder="Message or reference"
            className="lg:w-60"
          />
          <SelectField
            label="Severity"
            placeholder="All"
            options={Object.entries(SEVERITIES).map(([k, s]) => ({ value: k, label: s.label }))}
            value={t.filterValues.severity}
            onValueChange={(v) => t.setFilter('severity', v)}
          />
          <SelectField
            label="Service"
            placeholder="All services"
            options={Object.entries(SERVICES).map(([k, l]) => ({ value: k, label: l }))}
            value={t.filterValues.service}
            onValueChange={(v) => t.setFilter('service', v)}
          />
          <SelectField
            label="Category"
            placeholder="All"
            options={Object.entries(ERROR_CATEGORIES).map(([k, l]) => ({ value: k, label: l }))}
            value={t.filterValues.category}
            onValueChange={(v) => t.setFilter('category', v)}
          />
          <SelectField
            label="Status"
            placeholder="All"
            options={[
              { value: 'open', label: 'Open' },
              { value: 'reviewed', label: 'Reviewed' },
            ]}
            value={t.filterValues.status}
            onValueChange={(v) => t.setFilter('status', v)}
          />
          <DateRangePicker label="Date" from={t.dateFrom} to={t.dateTo} onChange={t.setDateRange} />
        </FilterBar>
        <DataTable
          caption="Error logs"
          loading={isPending}
          error={isError ? error : null}
          onRetry={refetch}
          rows={t.pageItems}
          rowLabel={(e) => e.id}
          sort={{ key: t.sortKey, dir: t.sortDir, onSort: t.setSort }}
          empty={{ icon: AlertOctagon, title: 'No errors match your filters' }}
          columns={[
            {
              key: 'at',
              header: 'Time',
              sortKey: 'at',
              cell: (e) => (
                <span className="whitespace-nowrap text-muted" title={formatDateTime(e.at)}>
                  {formatRelative(e.at)}
                </span>
              ),
            },
            {
              key: 'severity',
              header: 'Severity',
              sortKey: 'severity',
              cell: (e) => <StatusBadge status={e.severity} map={SEVERITIES} />,
            },
            {
              key: 'service',
              header: 'Service',
              hideBelow: 'md',
              cell: (e) => <span className="whitespace-nowrap">{SERVICES[e.service]}</span>,
            },
            {
              key: 'category',
              header: 'Category',
              hideBelow: 'xl',
              cell: (e) => (
                <span className="whitespace-nowrap text-muted">{ERROR_CATEGORIES[e.category]}</span>
              ),
            },
            {
              key: 'message',
              header: 'Message',
              cell: (e) => (
                <button
                  type="button"
                  onClick={() => setOpenId(e.id)}
                  className="block max-w-xs truncate text-left font-medium text-ink hover:text-accent-600"
                >
                  {e.message}
                </button>
              ),
            },
            {
              key: 'ref',
              header: 'Reference',
              hideBelow: 'lg',
              cell: (e) => <code className="text-xs text-muted">{e.reference}</code>,
            },
            {
              key: 'status',
              header: 'Status',
              hideBelow: 'sm',
              cell: (e) => (
                <Badge tone={e.status === 'reviewed' ? 'success' : 'neutral'} dot>
                  {e.status === 'reviewed' ? 'Reviewed' : 'Open'}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (e) => (
                <DropdownMenu
                  label={`Actions for ${e.id}`}
                  trigger={<IconButton label={`Actions for ${e.id}`} icon={MoreHorizontal} tooltip={false} />}
                  items={[
                    { label: 'View details', icon: Eye, onSelect: () => setOpenId(e.id) },
                    { label: 'Copy summary', icon: Copy, onSelect: () => copy(e) },
                    e.status !== 'reviewed' && {
                      label: 'Mark as reviewed',
                      icon: CheckCircle2,
                      onSelect: () => review.mutate(e.id),
                    },
                  ].filter(Boolean)}
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
          label="entries"
        />
      </Card>
      <Drawer
        open={Boolean(open)}
        onOpenChange={(o) => !o && setOpenId(null)}
        title={open?.message ?? ''}
        description={open ? `${open.id} · ${SERVICES[open.service]}` : ''}
        footer={
          open && (
            <>
              <Button variant="outline" icon={Copy} onClick={() => copy(open)}>
                Copy summary
              </Button>
              {open.status !== 'reviewed' && (
                <Button icon={CheckCircle2} loading={review.isPending} onClick={() => review.mutate(open.id)}>
                  Mark as reviewed
                </Button>
              )}
            </>
          )
        }
      >
        {open && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={open.severity} map={SEVERITIES} />
              <Badge>{ERROR_CATEGORIES[open.category]}</Badge>
              <Badge tone={open.status === 'reviewed' ? 'success' : 'neutral'} dot>
                {open.status === 'reviewed' ? 'Reviewed' : 'Open'}
              </Badge>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted">Timestamp</dt>
                <dd>{formatDateTime(open.at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Request / job reference</dt>
                <dd>
                  <code className="text-xs">{open.reference}</code>
                </dd>
              </div>
            </dl>
            <div>
              <p className="text-xs text-muted">Details</p>
              <p className="mt-1 rounded-xl bg-subtle/60 p-3 font-mono text-xs leading-relaxed">
                {open.details}
              </p>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
