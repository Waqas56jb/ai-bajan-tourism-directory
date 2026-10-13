import { useMemo, useState } from 'react';
import { CheckCircle2, Inbox, MessageSquareWarning, XCircle } from 'lucide-react';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useTableState';
import { useLookups } from '@/hooks/useLookups';
import { getListings, bulkSetListingStatus } from '@/services/listingService';
import { getUsers } from '@/services/userService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { FilterBar } from '@/components/common/FilterBar';
import { SearchInput, SelectField } from '@/components/common/Fields';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { Avatar } from '@/components/common/Avatar';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { ListingThumb } from '@/components/listings/ListingStatusBadge';
import { ListingDetailsDrawer } from '@/components/listings/ListingDetailsDrawer';
import { useListingActions } from '@/components/listings/useListingActions';
import { formatRelative, formatDateTime } from '@/utils/formatDate';

export default function ListingSubmissionsPage() {
  const { data: listings = [], isPending, isError, error, refetch } = useApiQuery('listings', getListings);
  const users = useApiQuery('users', getUsers);
  const lookups = useLookups();
  const actions = useListingActions();
  const confirm = useConfirm();
  const [openId, setOpenId] = useState(null);

  const userById = useMemo(() => Object.fromEntries((users.data ?? []).map((u) => [u.id, u])), [users.data]);
  const pending = useMemo(
    () =>
      listings
        .filter((l) => l.status === 'pending')
        .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt)),
    [listings],
  );

  const config = useMemo(
    () => ({
      searchFields: (l) => [
        l.name,
        l.shortDescription,
        userById[l.submittedBy]?.name,
        userById[l.submittedBy]?.email,
        lookups.placeLabel(l.location),
      ],
      filters: { category: (l, v) => l.categoryId === v },
      dateField: 'submittedAt',
      sorters: { submittedAt: (l) => new Date(l.submittedAt).getTime(), name: (l) => l.name },
      defaultSort: { key: 'submittedAt', dir: 'asc' },
    }),
    [userById, lookups],
  );
  const t = useTableState(pending, config);

  const bulkApprove = useApiMutation((ids) => bulkSetListingStatus(ids, 'published'), {
    invalidate: [['listings'], ['syncJobs']],
    success: (rows) => `Approved ${rows.length} submission(s)`,
    error: 'Bulk approval failed',
    onSuccess: () => t.clearSelection(),
  });

  const open = listings.find((l) => l.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Pending submissions"
        description="Review new and edited listings submitted by business owners. Oldest submissions are shown first."
        badge={
          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning tabular">
            {pending.length} waiting
          </span>
        }
      />
      <Card padded={false}>
        <FilterBar
          chips={[
            t.q && { key: 'q', label: `Search: “${t.q}”`, onRemove: () => t.setQ('') },
            t.filterValues.category && {
              key: 'c',
              label: lookups.categoryName(t.filterValues.category),
              onRemove: () => t.setFilter('category', ''),
            },
          ].filter(Boolean)}
          onReset={t.resetAll}
        >
          <SearchInput
            value={t.q}
            onChange={t.setQ}
            label="Search submissions"
            placeholder="Business or submitter…"
            className="lg:w-72"
          />
          <SelectField
            label="Category"
            placeholder="All categories"
            options={lookups.categories.map((c) => ({ value: c.id, label: c.name }))}
            value={t.filterValues.category}
            onValueChange={(v) => t.setFilter('category', v)}
          />
          <DateRangePicker label="Submitted" from={t.dateFrom} to={t.dateTo} onChange={t.setDateRange} />
        </FilterBar>
        {t.selectedIds.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-2 border-b border-line bg-accent-50/60 px-4 py-2.5"
            role="region"
            aria-label="Bulk actions"
          >
            <span className="mr-2 text-sm font-medium">{t.selectedIds.length} selected</span>
            <Button
              size="sm"
              variant="accent"
              icon={CheckCircle2}
              loading={bulkApprove.isPending}
              onClick={async () => {
                if (
                  await confirm({
                    title: `Approve ${t.selectedIds.length} submission(s)?`,
                    message: 'They will be published and queued for chatbot indexing (simulated).',
                    confirmLabel: 'Approve all',
                  })
                )
                  bulkApprove.mutate(t.selectedIds);
              }}
            >
              Approve selected
            </Button>
            <button
              type="button"
              onClick={t.clearSelection}
              className="ml-auto text-xs font-medium text-muted hover:text-ink"
            >
              Clear selection
            </button>
          </div>
        )}
        <DataTable
          caption="Pending submissions"
          loading={isPending || lookups.isLoading}
          error={isError ? error : null}
          onRetry={refetch}
          rows={t.pageItems}
          selection={t}
          sort={{ key: t.sortKey, dir: t.sortDir, onSort: t.setSort }}
          empty={{
            icon: Inbox,
            title: pending.length ? 'No submissions match your filters' : 'No pending submissions',
            description: pending.length
              ? 'Try clearing filters.'
              : 'New submissions from business owners will appear here.',
          }}
          columns={[
            {
              key: 'name',
              header: 'Business',
              sortKey: 'name',
              cell: (l) => (
                <button
                  type="button"
                  onClick={() => setOpenId(l.id)}
                  className="flex min-w-[14rem] items-center gap-3 text-left"
                >
                  <ListingThumb listing={l} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink hover:text-accent-600">
                      {l.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {lookups.categoryName(l.categoryId)} · {lookups.placeLabel(l.location)}
                    </span>
                  </span>
                </button>
              ),
            },
            {
              key: 'submitter',
              header: 'Submitted by',
              hideBelow: 'md',
              cell: (l) => {
                const u = userById[l.submittedBy];
                return u ? (
                  <span className="flex items-center gap-2">
                    <Avatar name={u.name} size="xs" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{u.name}</span>
                      <span className="block truncate text-xs text-muted">{u.email}</span>
                    </span>
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                );
              },
            },
            {
              key: 'submitted',
              header: 'Submitted',
              sortKey: 'submittedAt',
              hideBelow: 'sm',
              cell: (l) => (
                <span className="whitespace-nowrap text-muted" title={formatDateTime(l.submittedAt)}>
                  {formatRelative(l.submittedAt)}
                </span>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (l) => (
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => setOpenId(l.id)}>
                    Review
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={MessageSquareWarning}
                    className="hidden 2xl:inline-flex"
                    onClick={() => actions.requestChanges(l)}
                  >
                    Changes
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive-outline"
                    icon={XCircle}
                    className="hidden xl:inline-flex"
                    onClick={() => actions.reject(l)}
                  >
                    Reject
                  </Button>
                  <Button size="sm" variant="accent" icon={CheckCircle2} onClick={() => actions.approve(l)}>
                    Approve
                  </Button>
                </div>
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
          label="submissions"
        />
      </Card>
      <ListingDetailsDrawer
        listing={open}
        open={Boolean(open)}
        onOpenChange={(o) => !o && setOpenId(null)}
        submitter={open ? userById[open.submittedBy] : null}
        categoryName={lookups.categoryName}
        placeLabel={lookups.placeLabel}
        actions={actions}
      />
    </>
  );
}
