import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Archive, Megaphone, MoreHorizontal, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useTableState';
import {
  getAdvertisements,
  createAdvertisement,
  updateAdvertisement,
  deleteAdvertisement,
} from '@/services/advertisingService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { FilterBar } from '@/components/common/FilterBar';
import { SearchInput, SelectField, TextField, TextAreaField } from '@/components/common/Fields';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import { StatusBadge, DemoBadge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { ImageUploadPreview, ImageWithFallback } from '@/components/common/ImageUploadPreview';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { DemoNotice } from '@/components/common/States';
import { AD_PLACEMENTS, AD_STATUSES } from '@/utils/constants';
import { formatDate, toInputDate, daysBetween } from '@/utils/formatDate';
import { formatNumber, formatPercent } from '@/utils/formatNumber';
import { isValidUrl, safeExternalUrl } from '@/utils/validation';

const schema = z
  .object({
    name: z.string().trim().min(3, 'Campaign name is required.').max(80),
    advertiser: z.string().trim().min(2, 'Advertiser is required.').max(80),
    destinationUrl: z.string().trim().refine(isValidUrl, 'Enter a full URL starting with https://'),
    imageUrl: z
      .string()
      .trim()
      .refine((v) => !v || isValidUrl(v), 'Enter a full image URL.'),
    placement: z.enum(Object.keys(AD_PLACEMENTS)),
    startDate: z.string().min(1, 'Choose a start date.'),
    endDate: z.string().min(1, 'Choose an end date.'),
    status: z.enum(Object.keys(AD_STATUSES)),
    notes: z.string().max(500),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    path: ['endDate'],
    message: 'End date must be on or after the start date.',
  });

function CampaignModal({ open, onOpenChange, ad }) {
  const editing = Boolean(ad?.id);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });
  const v = useWatch({ control });
  useEffect(() => {
    if (open)
      reset({
        name: ad?.name ?? '',
        advertiser: ad?.advertiser ?? '',
        destinationUrl: ad?.destinationUrl ?? '',
        imageUrl: ad?.imageUrl ?? '',
        placement: ad?.placement ?? 'homepage_banner',
        startDate: toInputDate(ad?.startDate ?? new Date()),
        endDate: toInputDate(ad?.endDate ?? new Date(Date.now() + 30 * 86_400_000)),
        status: ad?.status ?? 'draft',
        notes: ad?.notes ?? '',
      });
  }, [open, ad, reset]);

  const save = useApiMutation(
    (values) => {
      const payload = {
        ...values,
        startDate: new Date(`${values.startDate}T00:00:00`).toISOString(),
        endDate: new Date(`${values.endDate}T23:59:00`).toISOString(),
        imageUrl: values.imageUrl || null,
      };
      return editing ? updateAdvertisement(ad.id, payload) : createAdvertisement(payload);
    },
    {
      invalidate: [['ads']],
      success: (a) => `${editing ? 'Saved' : 'Created'} “${a.name}”`,
      error: 'Couldn’t save the campaign',
      onSuccess: () => onOpenChange(false),
    },
  );

  const submit = (status) =>
    handleSubmit((values) => save.mutate({ ...values, status: status ?? values.status }));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit campaign' : 'New campaign'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={submit('draft')} disabled={save.isPending}>
            Save draft
          </Button>
          <Button icon={Play} onClick={submit('active')} loading={save.isPending}>
            Save and activate
          </Button>
        </>
      }
    >
      <form noValidate onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="Campaign name" required error={errors.name?.message} {...register('name')} />
        <TextField
          label="Advertiser"
          required
          error={errors.advertiser?.message}
          {...register('advertiser')}
        />
        <TextField
          label="Destination URL"
          required
          type="url"
          placeholder="https://"
          error={errors.destinationUrl?.message}
          className="sm:col-span-2"
          {...register('destinationUrl')}
        />
        <SelectField
          label="Placement"
          options={Object.entries(AD_PLACEMENTS).map(([k, l]) => ({ value: k, label: l }))}
          {...register('placement')}
        />
        <SelectField
          label="Status"
          options={Object.entries(AD_STATUSES).map(([k, s]) => ({ value: k, label: s.label }))}
          {...register('status')}
        />
        <TextField
          label="Start date"
          required
          type="date"
          error={errors.startDate?.message}
          {...register('startDate')}
        />
        <TextField
          label="End date"
          required
          type="date"
          min={v.startDate}
          error={errors.endDate?.message}
          {...register('endDate')}
        />
        <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-[1fr_180px]">
          <TextField
            label="Image URL"
            type="url"
            placeholder="https://"
            error={errors.imageUrl?.message}
            {...register('imageUrl')}
          />
          {v.imageUrl && isValidUrl(v.imageUrl) ? (
            <ImageUploadPreview src={v.imageUrl} alt="" label="campaign image" />
          ) : (
            <div className="hidden aspect-[4/3] place-items-center rounded-xl border-2 border-dashed border-line text-xs text-muted sm:grid">
              No image
            </div>
          )}
        </div>
        <TextAreaField
          label="Internal notes"
          rows={2}
          maxLength={500}
          value={v.notes}
          className="sm:col-span-2"
          helper="Not shown publicly."
          {...register('notes')}
        />
      </form>
    </Modal>
  );
}

export default function AdvertisementsPage() {
  const { data: ads = [], isPending, isError, error, refetch } = useApiQuery('ads', getAdvertisements);
  const [editing, setEditing] = useState(null);
  const confirm = useConfirm();

  const config = useMemo(
    () => ({
      searchFields: (a) => [a.name, a.advertiser],
      filters: { status: (a, v) => a.status === v, placement: (a, v) => a.placement === v },
      sorters: {
        name: (a) => a.name,
        startDate: (a) => new Date(a.startDate).getTime(),
        endDate: (a) => new Date(a.endDate).getTime(),
        impressions: (a) => a.impressions,
        clicks: (a) => a.clicks,
      },
      defaultSort: { key: 'startDate', dir: 'desc' },
    }),
    [],
  );
  const t = useTableState(ads, config);

  const setStatus = useApiMutation(({ id, status }) => updateAdvertisement(id, { status }), {
    invalidate: [['ads']],
    success: (a) => `“${a.name}” is now ${AD_STATUSES[a.status].label.toLowerCase()}`,
    error: 'Couldn’t change status',
  });
  const remove = useApiMutation((id) => deleteAdvertisement(id), {
    invalidate: [['ads']],
    success: 'Campaign deleted',
    error: 'Delete failed',
  });

  const menu = (a) =>
    [
      { label: 'Edit', icon: Pencil, onSelect: () => setEditing(a) },
      a.status !== 'active' &&
        a.status !== 'archived' && {
          label: 'Activate',
          icon: Play,
          onSelect: () => setStatus.mutate({ id: a.id, status: 'active' }),
        },
      a.status === 'active' && {
        label: 'Pause',
        icon: Pause,
        onSelect: () => setStatus.mutate({ id: a.id, status: 'paused' }),
      },
      a.status !== 'archived' && {
        label: 'Archive',
        icon: Archive,
        onSelect: () => setStatus.mutate({ id: a.id, status: 'archived' }),
      },
      {
        label: 'Delete',
        icon: Trash2,
        tone: 'danger',
        separatorBefore: true,
        onSelect: async () => {
          if (
            await confirm({
              title: `Delete “${a.name}”?`,
              message: 'The campaign and its sample metrics will be removed.',
              confirmLabel: 'Delete',
              tone: 'danger',
            })
          )
            remove.mutate(a.id);
        },
      },
    ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Advertisements"
        description="Promotional campaigns and placements. Every paid placement is labelled “Sponsored” on the public site."
        actions={
          <Button icon={Plus} onClick={() => setEditing({})}>
            New campaign
          </Button>
        }
      />
      <DemoNotice className="mb-5" title="Sample metrics">
        Impressions and clicks are illustrative — no advertising analytics are collected yet.
      </DemoNotice>
      <Card padded={false}>
        <FilterBar
          chips={[
            t.q && { key: 'q', label: `Search: “${t.q}”`, onRemove: () => t.setQ('') },
            t.filterValues.status && {
              key: 's',
              label: AD_STATUSES[t.filterValues.status].label,
              onRemove: () => t.setFilter('status', ''),
            },
            t.filterValues.placement && {
              key: 'p',
              label: AD_PLACEMENTS[t.filterValues.placement],
              onRemove: () => t.setFilter('placement', ''),
            },
          ].filter(Boolean)}
          onReset={t.resetAll}
        >
          <SearchInput
            value={t.q}
            onChange={t.setQ}
            label="Search campaigns"
            placeholder="Campaign or advertiser"
            className="lg:w-64"
          />
          <SelectField
            label="Status"
            placeholder="All"
            options={Object.entries(AD_STATUSES).map(([k, s]) => ({ value: k, label: s.label }))}
            value={t.filterValues.status}
            onValueChange={(x) => t.setFilter('status', x)}
          />
          <SelectField
            label="Placement"
            placeholder="All"
            options={Object.entries(AD_PLACEMENTS).map(([k, l]) => ({ value: k, label: l }))}
            value={t.filterValues.placement}
            onValueChange={(x) => t.setFilter('placement', x)}
          />
        </FilterBar>
        <DataTable
          caption="Advertising campaigns"
          loading={isPending}
          error={isError ? error : null}
          onRetry={refetch}
          rows={t.pageItems}
          sort={{ key: t.sortKey, dir: t.sortDir, onSort: t.setSort }}
          empty={{
            icon: Megaphone,
            title: 'No campaigns found',
            action: (
              <Button size="sm" icon={Plus} onClick={() => setEditing({})}>
                New campaign
              </Button>
            ),
          }}
          columns={[
            {
              key: 'name',
              header: 'Campaign',
              sortKey: 'name',
              cell: (a) => {
                const dest = safeExternalUrl(a.destinationUrl);
                const left = daysBetween(new Date(), a.endDate);
                return (
                  <div className="flex min-w-[14rem] items-center gap-3">
                    <ImageWithFallback src={a.imageUrl} alt="" className="h-10 w-14 shrink-0 rounded-md" />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setEditing(a)}
                        className="block truncate text-left font-medium text-ink hover:text-accent-600"
                      >
                        {a.name}
                      </button>
                      <p className="truncate text-xs text-muted">
                        {a.advertiser}
                        {dest && (
                          <>
                            {' · '}
                            <a
                              href={dest}
                              target="_blank"
                              rel="noopener noreferrer sponsored"
                              className="hover:underline"
                            >
                              {new URL(dest).host}
                            </a>
                          </>
                        )}
                      </p>
                      {a.status === 'active' && left !== null && left >= 0 && left <= 7 && (
                        <p className="text-2xs font-semibold text-warning">
                          Ends in {left} day{left === 1 ? '' : 's'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              },
            },
            {
              key: 'placement',
              header: 'Placement',
              hideBelow: 'lg',
              cell: (a) => <span className="whitespace-nowrap text-muted">{AD_PLACEMENTS[a.placement]}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              cell: (a) => <StatusBadge status={a.status} map={AD_STATUSES} />,
            },
            {
              key: 'start',
              header: 'Start',
              sortKey: 'startDate',
              hideBelow: 'md',
              cell: (a) => <span className="whitespace-nowrap text-muted">{formatDate(a.startDate)}</span>,
            },
            {
              key: 'end',
              header: 'End',
              sortKey: 'endDate',
              hideBelow: 'md',
              cell: (a) => <span className="whitespace-nowrap text-muted">{formatDate(a.endDate)}</span>,
            },
            {
              key: 'impressions',
              header: 'Impressions',
              sortKey: 'impressions',
              align: 'right',
              hideBelow: 'sm',
              cell: (a) => formatNumber(a.impressions),
            },
            {
              key: 'clicks',
              header: 'Clicks',
              sortKey: 'clicks',
              align: 'right',
              hideBelow: 'xl',
              cell: (a) => (
                <span>
                  {formatNumber(a.clicks)}{' '}
                  <span className="text-2xs text-muted">
                    ({a.impressions ? formatPercent(a.clicks / a.impressions, 1) : '—'})
                  </span>
                </span>
              ),
            },
            {
              key: 'actions',
              header: <DemoBadge>Sample</DemoBadge>,
              align: 'right',
              cell: (a) => (
                <DropdownMenu
                  label={`Actions for ${a.name}`}
                  items={menu(a)}
                  trigger={
                    <IconButton label={`Actions for ${a.name}`} icon={MoreHorizontal} tooltip={false} />
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
          label="campaigns"
        />
      </Card>
      <CampaignModal
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        ad={editing?.id ? editing : null}
      />
    </>
  );
}
