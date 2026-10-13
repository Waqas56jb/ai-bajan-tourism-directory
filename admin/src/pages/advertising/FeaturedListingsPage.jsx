import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  MoreHorizontal,
  Pencil,
  Power,
  Star,
  Trash2,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useTableState';
import { useLookups } from '@/hooks/useLookups';
import {
  getFeaturedPlacements,
  createFeaturedPlacement,
  updateFeaturedPlacement,
  deleteFeaturedPlacement,
} from '@/services/advertisingService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { FilterBar } from '@/components/common/FilterBar';
import { SearchInput, SelectField, TextField } from '@/components/common/Fields';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import { Badge, DemoBadge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { ImageWithFallback } from '@/components/common/ImageUploadPreview';
import { ListingStatusBadge, ListingThumb } from '@/components/listings/ListingStatusBadge';
import { FEATURED_PLACEMENTS } from '@/utils/constants';
import { formatDate, toInputDate, daysBetween } from '@/utils/formatDate';
import { formatNumber } from '@/utils/formatNumber';

const STATUS = {
  active: { label: 'Active', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  inactive: { label: 'Inactive', tone: 'muted' },
};

function PlacementModal({ open, onOpenChange, placement, placements }) {
  const editing = Boolean(placement?.id);
  const { listings, catById } = useLookups();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm({
        listingId: placement?.listingId ?? '',
        placement: placement?.placement ?? 'homepage',
        priority: placement?.priority ?? 1,
        status: placement?.status ?? 'active',
        startDate: toInputDate(placement?.startDate ?? new Date()),
        endDate: toInputDate(placement?.endDate ?? new Date(Date.now() + 30 * 86_400_000)),
      });
      setErrors({});
      setSearch('');
    }
  }, [open, placement]);

  const save = useApiMutation(
    (f) => {
      const payload = {
        ...f,
        priority: Number(f.priority),
        startDate: new Date(`${f.startDate}T00:00:00`).toISOString(),
        endDate: new Date(`${f.endDate}T23:59:00`).toISOString(),
      };
      return editing ? updateFeaturedPlacement(placement.id, payload) : createFeaturedPlacement(payload);
    },
    {
      invalidate: [['featured'], ['listings']],
      success: editing ? 'Placement updated' : 'Featured placement added',
      error: 'Couldn’t save placement',
      onSuccess: () => onOpenChange(false),
    },
  );

  if (!form) return null;
  const selected = listings.find((l) => l.id === form.listingId);
  const duplicate = placements.some(
    (p) => p.listingId === form.listingId && p.placement === form.placement && p.id !== placement?.id,
  );
  const results = listings.filter((l) => l.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const e = {};
    if (!form.listingId) e.listingId = 'Choose a listing.';
    if (duplicate) e.listingId = 'This listing is already featured in that placement.';
    if (!form.startDate) e.startDate = 'Required.';
    if (!form.endDate) e.endDate = 'Required.';
    if (form.startDate && form.endDate && form.endDate < form.startDate)
      e.endDate = 'End date must be on or after the start date.';
    if (!(Number(form.priority) >= 1 && Number(form.priority) <= 20))
      e.priority = 'Priority must be between 1 and 20.';
    setErrors(e);
    if (!Object.keys(e).length) save.mutate(form);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit featured placement' : 'Add featured listing'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            {editing ? 'Save placement' : 'Add placement'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="label">
            Listing <span className="text-danger">*</span>
          </legend>
          {selected ? (
            <div className="flex items-center gap-3 rounded-xl border border-line p-2.5">
              <ListingThumb listing={selected} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{selected.name}</p>
                <p className="text-xs text-muted">{catById[selected.categoryId]?.name}</p>
              </div>
              <ListingStatusBadge status={selected.status} />
              {!editing && (
                <Button size="sm" variant="ghost" onClick={() => set('listingId', '')}>
                  Change
                </Button>
              )}
            </div>
          ) : (
            <div>
              <SearchInput
                value={search}
                onChange={setSearch}
                label="Search listings to feature"
                placeholder="Search listings…"
                autoFocus
              />
              <ul
                className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line"
                role="listbox"
                aria-label="Listings"
              >
                {results.map((l) => (
                  <li key={l.id} role="option" aria-selected={false}>
                    <button
                      type="button"
                      onClick={() => set('listingId', l.id)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-subtle"
                    >
                      <ListingThumb listing={l} size="h-8 w-10" />
                      <span className="min-w-0 flex-1 truncate text-sm">{l.name}</span>
                      <ListingStatusBadge status={l.status} />
                    </button>
                  </li>
                ))}
                {results.length === 0 && (
                  <li className="px-3 py-4 text-center text-sm text-muted">No listings match “{search}”.</li>
                )}
              </ul>
            </div>
          )}
          {errors.listingId && (
            <p className="error-text" role="alert">
              {errors.listingId}
            </p>
          )}
          {selected && selected.status !== 'published' && (
            <p
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-xs font-medium text-warning"
              role="status"
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> This listing isn’t published —
              visitors won’t see the placement until it is.
            </p>
          )}
        </fieldset>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Placement"
            options={Object.entries(FEATURED_PLACEMENTS).map(([k, l]) => ({ value: k, label: l }))}
            value={form.placement}
            onValueChange={(v) => set('placement', v)}
            error={duplicate && form.listingId ? 'Already featured here.' : undefined}
          />
          <TextField
            label="Priority"
            type="number"
            min={1}
            max={20}
            value={form.priority}
            onChange={(e) => set('priority', e.target.value)}
            error={errors.priority}
            helper="1 = shown first."
          />
          <TextField
            label="Start date"
            required
            type="date"
            value={form.startDate}
            onChange={(e) => set('startDate', e.target.value)}
            error={errors.startDate}
          />
          <TextField
            label="End date"
            required
            type="date"
            min={form.startDate}
            value={form.endDate}
            onChange={(e) => set('endDate', e.target.value)}
            error={errors.endDate}
          />
          <SelectField
            label="Status"
            options={Object.entries(STATUS).map(([k, s]) => ({ value: k, label: s.label }))}
            value={form.status}
            onValueChange={(v) => set('status', v)}
          />
        </div>
      </div>
    </Modal>
  );
}

export default function FeaturedListingsPage() {
  const {
    data: placements = [],
    isPending,
    isError,
    error,
    refetch,
  } = useApiQuery('featured', getFeaturedPlacements);
  const { listingById, catById, placeLabel, isLoading } = useLookups();
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const confirm = useConfirm();

  const rows = useMemo(
    () => placements.map((p) => ({ ...p, listing: listingById[p.listingId] })).filter((p) => p.listing),
    [placements, listingById],
  );
  const config = useMemo(
    () => ({
      searchFields: (p) => [p.listing.name],
      filters: { placement: (p, v) => p.placement === v, status: (p, v) => p.status === v },
      sorters: {
        priority: (p) => `${p.placement}-${String(p.priority).padStart(2, '0')}`,
        endDate: (p) => new Date(p.endDate).getTime(),
        impressions: (p) => p.impressions,
      },
      defaultSort: { key: 'priority', dir: 'asc' },
    }),
    [],
  );
  const t = useTableState(rows, config);

  const update = useApiMutation(({ id, changes }) => updateFeaturedPlacement(id, changes), {
    invalidate: [['featured'], ['listings']],
    success: 'Placement updated',
    error: 'Couldn’t update placement',
  });
  const remove = useApiMutation((id) => deleteFeaturedPlacement(id), {
    invalidate: [['featured'], ['listings']],
    success: 'Removed from featured',
    error: 'Couldn’t remove placement',
  });

  const menu = (p) => [
    { label: 'Edit placement', icon: Pencil, onSelect: () => setEditing(p) },
    { label: 'Preview placement', icon: Eye, onSelect: () => setPreview(p) },
    {
      label: 'Move up',
      icon: ArrowUp,
      disabled: p.priority <= 1,
      onSelect: () => update.mutate({ id: p.id, changes: { priority: p.priority - 1 } }),
    },
    {
      label: 'Move down',
      icon: ArrowDown,
      disabled: p.priority >= 20,
      onSelect: () => update.mutate({ id: p.id, changes: { priority: p.priority + 1 } }),
    },
    {
      label: p.status === 'active' ? 'Deactivate' : 'Activate',
      icon: Power,
      onSelect: () =>
        update.mutate({ id: p.id, changes: { status: p.status === 'active' ? 'inactive' : 'active' } }),
    },
    {
      label: 'Remove from featured',
      icon: Trash2,
      tone: 'danger',
      separatorBefore: true,
      onSelect: async () => {
        if (
          await confirm({
            title: 'Remove featured placement?',
            message: `“${p.listing.name}” will no longer appear in ${FEATURED_PLACEMENTS[p.placement]}.`,
            confirmLabel: 'Remove',
            tone: 'danger',
          })
        )
          remove.mutate(p.id);
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Featured listings"
        description="Promoted placements across the public site. Featured items are labelled for visitors."
        actions={
          <Button icon={Plus} onClick={() => setEditing({})}>
            Add featured listing
          </Button>
        }
      />
      <Card padded={false}>
        <FilterBar
          chips={[
            t.q && { key: 'q', label: `Search: “${t.q}”`, onRemove: () => t.setQ('') },
            t.filterValues.placement && {
              key: 'p',
              label: FEATURED_PLACEMENTS[t.filterValues.placement],
              onRemove: () => t.setFilter('placement', ''),
            },
            t.filterValues.status && {
              key: 's',
              label: STATUS[t.filterValues.status].label,
              onRemove: () => t.setFilter('status', ''),
            },
          ].filter(Boolean)}
          onReset={t.resetAll}
        >
          <SearchInput
            value={t.q}
            onChange={t.setQ}
            label="Search featured listings"
            placeholder="Listing name"
            className="lg:w-64"
          />
          <SelectField
            label="Placement"
            placeholder="All"
            options={Object.entries(FEATURED_PLACEMENTS).map(([k, l]) => ({ value: k, label: l }))}
            value={t.filterValues.placement}
            onValueChange={(v) => t.setFilter('placement', v)}
          />
          <SelectField
            label="Status"
            placeholder="All"
            options={Object.entries(STATUS).map(([k, s]) => ({ value: k, label: s.label }))}
            value={t.filterValues.status}
            onValueChange={(v) => t.setFilter('status', v)}
          />
        </FilterBar>
        <DataTable
          caption="Featured placements"
          loading={isPending || isLoading}
          error={isError ? error : null}
          onRetry={refetch}
          rows={t.pageItems}
          rowLabel={(p) => p.listing.name}
          sort={{ key: t.sortKey, dir: t.sortDir, onSort: t.setSort }}
          empty={{
            icon: Star,
            title: 'No featured placements',
            action: (
              <Button size="sm" icon={Plus} onClick={() => setEditing({})}>
                Add featured listing
              </Button>
            ),
          }}
          columns={[
            {
              key: 'listing',
              header: 'Listing',
              cell: (p) => (
                <div className="flex min-w-[14rem] items-center gap-3">
                  <ListingThumb listing={p.listing} />
                  <div className="min-w-0">
                    <Link
                      to={`/listings/${p.listing.id}`}
                      className="block truncate font-medium text-ink hover:text-accent-600"
                    >
                      {p.listing.name}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {p.listing.status !== 'published' && (
                        <Badge tone="warning" icon={AlertTriangle}>
                          Not published
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: 'placement',
              header: 'Placement',
              hideBelow: 'md',
              cell: (p) => (
                <span className="whitespace-nowrap text-muted">{FEATURED_PLACEMENTS[p.placement]}</span>
              ),
            },
            {
              key: 'priority',
              header: 'Priority',
              sortKey: 'priority',
              align: 'right',
              cell: (p) => <span className="font-semibold">{p.priority}</span>,
            },
            {
              key: 'dates',
              header: 'Schedule',
              sortKey: 'endDate',
              hideBelow: 'lg',
              cell: (p) => {
                const left = daysBetween(new Date(), p.endDate);
                return (
                  <div className="whitespace-nowrap text-xs">
                    <p className="text-muted">
                      {formatDate(p.startDate)} → {formatDate(p.endDate)}
                    </p>
                    {p.status === 'active' && left !== null && left >= 0 && left <= 7 && (
                      <p className="font-semibold text-warning">
                        Expires in {left} day{left === 1 ? '' : 's'}
                      </p>
                    )}
                    {left !== null && left < 0 && <p className="font-semibold text-muted">Ended</p>}
                  </div>
                );
              },
            },
            {
              key: 'status',
              header: 'Status',
              cell: (p) => (
                <Badge tone={STATUS[p.status].tone} dot>
                  {STATUS[p.status].label}
                </Badge>
              ),
            },
            {
              key: 'impressions',
              header: 'Impr.',
              sortKey: 'impressions',
              align: 'right',
              hideBelow: 'xl',
              cell: (p) => formatNumber(p.impressions),
            },
            {
              key: 'clicks',
              header: 'Clicks',
              align: 'right',
              hideBelow: 'xl',
              cell: (p) => formatNumber(p.clicks),
            },
            {
              key: 'actions',
              header: <DemoBadge>Sample</DemoBadge>,
              align: 'right',
              cell: (p) => (
                <DropdownMenu
                  label={`Actions for ${p.listing.name}`}
                  items={menu(p)}
                  trigger={
                    <IconButton
                      label={`Actions for ${p.listing.name}`}
                      icon={MoreHorizontal}
                      tooltip={false}
                    />
                  }
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
          label="placements"
        />
      </Card>

      <PlacementModal
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        placement={editing?.id ? editing : null}
        placements={placements}
      />

      <Modal
        open={Boolean(preview)}
        onOpenChange={(o) => !o && setPreview(null)}
        title="Placement preview"
        description={preview ? FEATURED_PLACEMENTS[preview.placement] : ''}
        size="sm"
      >
        {preview && (
          <article className="overflow-hidden rounded-2xl border border-line bg-white text-[#1d2935] shadow-card">
            <div className="relative">
              <ImageWithFallback src={preview.listing.media.featuredImage} alt="" className="aspect-[4/3]" />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#123044] px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-white">
                <Star className="h-3 w-3" aria-hidden="true" /> Featured
              </span>
            </div>
            <div className="p-4">
              <p className="text-[0.7rem] font-bold uppercase tracking-wider text-[#0b7671]">
                {catById[preview.listing.categoryId]?.name}
              </p>
              <p className="mt-1 font-bold text-[#123044]">{preview.listing.name}</p>
              <p className="text-xs text-[#5b6973]">{placeLabel(preview.listing.location)}</p>
              <p className="mt-2 text-sm">{preview.listing.shortDescription}</p>
            </div>
          </article>
        )}
      </Modal>
    </>
  );
}
