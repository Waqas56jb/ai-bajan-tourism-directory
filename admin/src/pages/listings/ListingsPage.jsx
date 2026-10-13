import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Building2, Download, MoreHorizontal, Plus, Send, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useTableState';
import { useLookups } from '@/hooks/useLookups';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { getListings, bulkSetListingStatus, bulkDeleteListings } from '@/services/listingService';
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
import { ColumnToggle } from '@/components/common/ColumnToggle';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { ListingStatusBadge, ListingThumb, FeaturedBadge } from '@/components/listings/ListingStatusBadge';
import { useListingActions } from '@/components/listings/useListingActions';
import { LISTING_STATUSES } from '@/utils/constants';
import { formatDate, toInputDate } from '@/utils/formatDate';
import { formatNumber } from '@/utils/formatNumber';
import { exportCSV } from '@/utils/csv';

const SORT_OPTIONS = [
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'name:desc', label: 'Name Z–A' },
  { value: 'category:asc', label: 'Category' },
  { value: 'location:asc', label: 'Location' },
  { value: 'status:asc', label: 'Status' },
  { value: 'views:desc', label: 'Most viewed' },
];

export default function ListingsPage() {
  const {
    data: listings = [],
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useApiQuery('listings', getListings);
  const lookups = useLookups();
  const { catById, locById, placeLabel, categories, locations } = lookups;
  const actions = useListingActions();
  const confirm = useConfirm();
  const [hidden, setHidden] = useLocalStorage('listings_hidden_columns', []);

  const config = useMemo(
    () => ({
      searchFields: (l) => [
        l.name,
        l.shortDescription,
        l.description,
        catById[l.categoryId]?.name,
        locById[l.location.cityId]?.name,
        locById[l.location.regionId]?.name,
        locById[l.location.neighborhoodId]?.name,
        l.contact.email,
        l.contact.phone,
      ],
      filters: {
        status: (l, v) => l.status === v,
        featured: (l, v) => (v === 'yes' ? l.featured : !l.featured),
        category: (l, v) => l.categoryId === v || l.secondaryCategoryIds?.includes(v),
        location: (l, v) => [l.location.regionId, l.location.cityId, l.location.neighborhoodId].includes(v),
      },
      dateField: 'updatedAt',
      sorters: {
        name: (l) => l.name.toLowerCase(),
        category: (l) => catById[l.categoryId]?.name ?? '',
        location: (l) => placeLabel(l.location),
        status: (l) => l.status,
        createdAt: (l) => new Date(l.createdAt).getTime(),
        updatedAt: (l) => new Date(l.updatedAt).getTime(),
        views: (l) => l.views,
      },
      defaultSort: { key: 'updatedAt', dir: 'desc' },
    }),
    [catById, locById, placeLabel],
  );
  const t = useTableState(listings, config);

  const bulkStatus = useApiMutation(({ ids, status }) => bulkSetListingStatus(ids, status), {
    invalidate: [['listings'], ['syncJobs']],
    success: (rows, v) =>
      `${rows.length} listing(s) set to ${LISTING_STATUSES[v.status].label.toLowerCase()}`,
    error: 'Bulk update failed',
    onSuccess: () => t.clearSelection(),
  });
  const bulkDelete = useApiMutation((ids) => bulkDeleteListings(ids), {
    invalidate: [['listings'], ['featured']],
    success: (r) => `${r.ids.length} listing(s) deleted`,
    error: 'Bulk delete failed',
    onSuccess: () => t.clearSelection(),
  });

  const csvColumns = [
    { label: 'ID', value: 'id' },
    { label: 'Name', value: 'name' },
    { label: 'Category', value: (l) => catById[l.categoryId]?.name ?? '' },
    { label: 'Location', value: (l) => placeLabel(l.location) },
    { label: 'Status', value: 'status' },
    { label: 'Featured', value: (l) => (l.featured ? 'yes' : 'no') },
    { label: 'Email', value: (l) => l.contact.email },
    { label: 'Phone', value: (l) => l.contact.phone },
    { label: 'Views (sample)', value: 'views' },
    { label: 'Updated', value: (l) => l.updatedAt },
  ];

  const exportRows = (rows, label) => {
    exportCSV(`ai-bajan-listings-${toInputDate(new Date())}.csv`, rows, csvColumns);
    toast.success(`Exported ${rows.length} ${label}`, {
      description: 'CSV generated from the current demo data.',
    });
  };

  const selectedRows = listings.filter((l) => t.selectedIds.includes(l.id));

  const columns = [
    {
      key: 'name',
      header: 'Business',
      sortKey: 'name',
      required: true,
      cell: (l) => (
        <div className="flex min-w-[14rem] items-center gap-3">
          <ListingThumb listing={l} />
          <div className="min-w-0">
            <Link
              to={`/listings/${l.id}`}
              className="block max-w-[18rem] truncate font-medium text-ink hover:text-accent-600"
            >
              {l.name}
            </Link>
            <p className="max-w-[18rem] truncate text-xs text-muted">{l.shortDescription}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortKey: 'category',
      hideBelow: 'md',
      cell: (l) => <span className="whitespace-nowrap text-muted">{catById[l.categoryId]?.name ?? '—'}</span>,
    },
    {
      key: 'location',
      header: 'Location',
      sortKey: 'location',
      hideBelow: 'lg',
      cell: (l) => <span className="whitespace-nowrap text-muted">{placeLabel(l.location)}</span>,
    },
    {
      key: 'contact',
      header: 'Contact',
      hideBelow: '2xl',
      cell: (l) => (
        <div className="max-w-[14rem] text-xs">
          <p className="truncate text-ink">{l.contact.email || '—'}</p>
          <p className="truncate text-muted">{l.contact.phone || '—'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortKey: 'status',
      cell: (l) => <ListingStatusBadge status={l.status} />,
    },
    {
      key: 'featured',
      header: 'Featured',
      hideBelow: 'md',
      cell: (l) => (l.featured ? <FeaturedBadge /> : <span className="text-xs text-muted">—</span>),
    },
    {
      key: 'views',
      header: 'Views',
      sortKey: 'views',
      align: 'right',
      hideBelow: '2xl',
      cell: (l) => formatNumber(l.views),
    },
    {
      key: 'updated',
      header: 'Updated',
      sortKey: 'updatedAt',
      hideBelow: 'sm',
      cell: (l) => <span className="whitespace-nowrap text-muted">{formatDate(l.updatedAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      required: true,
      cell: (l) => (
        <DropdownMenu
          label={`Actions for ${l.name}`}
          items={actions.menuFor(l)}
          trigger={<IconButton label={`Actions for ${l.name}`} icon={MoreHorizontal} tooltip={false} />}
        />
      ),
    },
  ];

  const chips = [
    t.q && { key: 'q', label: `Search: “${t.q}”`, onRemove: () => t.setQ('') },
    t.filterValues.status && {
      key: 'status',
      label: `Status: ${LISTING_STATUSES[t.filterValues.status]?.label}`,
      onRemove: () => t.setFilter('status', ''),
    },
    t.filterValues.category && {
      key: 'category',
      label: `Category: ${catById[t.filterValues.category]?.name ?? '…'}`,
      onRemove: () => t.setFilter('category', ''),
    },
    t.filterValues.location && {
      key: 'location',
      label: `Location: ${locById[t.filterValues.location]?.name ?? '…'}`,
      onRemove: () => t.setFilter('location', ''),
    },
    t.filterValues.featured && {
      key: 'featured',
      label: t.filterValues.featured === 'yes' ? 'Featured only' : 'Not featured',
      onRemove: () => t.setFilter('featured', ''),
    },
    (t.dateFrom || t.dateTo) && {
      key: 'date',
      label: `Updated: ${t.dateFrom || '…'} → ${t.dateTo || '…'}`,
      onRemove: () => t.setDateRange('', ''),
    },
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="All listings"
        description={`${listings.length} directory listings across ${categories.length} categories.`}
        actions={
          <>
            <Button
              variant="outline"
              icon={Download}
              onClick={() => exportRows(t.filtered, 'listings')}
              disabled={!t.filtered.length}
            >
              Export CSV
            </Button>
            <Button to="/listings/new" icon={Plus}>
              Add listing
            </Button>
          </>
        }
      />

      <Card padded={false}>
        <FilterBar
          chips={chips}
          onReset={t.resetAll}
          actions={
            <>
              <SelectField
                label="Sort by"
                hideLabel
                options={SORT_OPTIONS}
                value={`${t.sortKey}:${t.sortDir}`}
                onValueChange={(v) => {
                  const [k, d] = v.split(':');
                  t.setSortExplicit(k, d);
                }}
                className="w-44"
              />
              <ColumnToggle columns={columns} hidden={hidden} onChange={setHidden} />
            </>
          }
        >
          <SearchInput
            value={t.q}
            onChange={t.setQ}
            placeholder="Name, email, phone, place…"
            label="Search listings"
            className="sm:col-span-2 lg:w-72"
          />
          <SelectField
            label="Status"
            options={Object.entries(LISTING_STATUSES).map(([v, s]) => ({ value: v, label: s.label }))}
            placeholder="All statuses"
            value={t.filterValues.status}
            onValueChange={(v) => t.setFilter('status', v)}
          />
          <SelectField
            label="Category"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="All categories"
            value={t.filterValues.category}
            onValueChange={(v) => t.setFilter('category', v)}
          />
          <SelectField
            label="Location"
            options={locations
              .filter((l) => l.type !== 'country')
              .map((l) => ({
                value: l.id,
                label: `${l.type === 'region' ? '' : l.type === 'city' ? '— ' : '—— '}${l.name}`,
              }))}
            placeholder="All locations"
            value={t.filterValues.location}
            onValueChange={(v) => t.setFilter('location', v)}
          />
          <SelectField
            label="Featured"
            options={[
              { value: 'yes', label: 'Featured' },
              { value: 'no', label: 'Not featured' },
            ]}
            placeholder="Any"
            value={t.filterValues.featured}
            onValueChange={(v) => t.setFilter('featured', v)}
          />
          <DateRangePicker
            label="Updated"
            from={t.dateFrom}
            to={t.dateTo}
            onChange={t.setDateRange}
            className="sm:col-span-2"
          />
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
              variant="outline"
              icon={Send}
              loading={bulkStatus.isPending}
              onClick={() => bulkStatus.mutate({ ids: t.selectedIds, status: 'published' })}
            >
              Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={Undo2}
              onClick={() => bulkStatus.mutate({ ids: t.selectedIds, status: 'draft' })}
            >
              Move to draft
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={Archive}
              onClick={async () => {
                if (
                  await confirm({
                    title: `Archive ${t.selectedIds.length} listing(s)?`,
                    message: 'Archived listings are hidden and excluded from chatbot knowledge.',
                    confirmLabel: 'Archive',
                    tone: 'danger',
                  })
                ) {
                  bulkStatus.mutate({ ids: t.selectedIds, status: 'archived' });
                }
              }}
            >
              Archive
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={Download}
              onClick={() => exportRows(selectedRows, 'selected listings')}
            >
              Export selected
            </Button>
            <Button
              size="sm"
              variant="destructive-outline"
              icon={Trash2}
              loading={bulkDelete.isPending}
              onClick={async () => {
                if (
                  await confirm({
                    title: `Delete ${t.selectedIds.length} listing(s)?`,
                    message: 'This permanently removes them from the demo data.',
                    confirmLabel: 'Delete',
                    tone: 'danger',
                  })
                ) {
                  bulkDelete.mutate(t.selectedIds);
                }
              }}
            >
              Delete
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
          caption="Directory listings"
          columns={columns}
          hiddenColumns={new Set(hidden)}
          rows={t.pageItems}
          loading={isPending || lookups.isLoading}
          error={isError ? error : null}
          onRetry={refetch}
          retrying={isFetching}
          selection={t}
          sort={{ key: t.sortKey, dir: t.sortDir, onSort: t.setSort }}
          empty={{
            icon: Building2,
            title: listings.length ? 'No listings match your filters' : 'No listings yet',
            description: listings.length
              ? 'Try a different search or clear some filters.'
              : 'Create the first listing for the directory.',
            action: listings.length ? (
              <Button variant="outline" size="sm" onClick={t.resetAll}>
                Reset filters
              </Button>
            ) : (
              <Button size="sm" to="/listings/new" icon={Plus}>
                Add listing
              </Button>
            ),
          }}
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
          label="listings"
        />
      </Card>
    </>
  );
}
