import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronRight, Eye, MapPin, MoreHorizontal, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useTableState';
import { getLocations, createLocation, updateLocation, deleteLocation } from '@/services/locationService';
import { getListings } from '@/services/listingService';
import { LOCATION_TYPES } from '@/data/mockLocations';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { FilterBar } from '@/components/common/FilterBar';
import { SearchInput, SelectField, TextField, TextAreaField } from '@/components/common/Fields';
import { Toggle } from '@/components/common/Toggle';
import { Modal, Drawer } from '@/components/common/Modal';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import { Badge } from '@/components/common/Badge';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { LoadingState } from '@/components/common/States';
import { ListingStatusBadge } from '@/components/listings/ListingStatusBadge';
import { slugify, SLUG_PATTERN, isValidLatitude, isValidLongitude } from '@/utils/validation';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Name is required.').max(80),
    slug: z
      .string()
      .trim()
      .min(2, 'Slug is required.')
      .regex(SLUG_PATTERN, 'Lowercase letters, numbers and hyphens only.'),
    type: z.enum(['country', 'region', 'city', 'neighborhood']),
    parentId: z.string(),
    description: z.string().trim().max(300),
    lat: z.string().trim(),
    lng: z.string().trim(),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.type !== 'country' && !v.parentId)
      ctx.addIssue({
        path: ['parentId'],
        code: 'custom',
        message: `Choose a parent ${LOCATION_TYPES[LOCATION_TYPES[v.type].parentType].label.toLowerCase()}.`,
      });
    if (v.lat && !isValidLatitude(v.lat))
      ctx.addIssue({ path: ['lat'], code: 'custom', message: 'Latitude must be between -90 and 90.' });
    if (v.lng && !isValidLongitude(v.lng))
      ctx.addIssue({ path: ['lng'], code: 'custom', message: 'Longitude must be between -180 and 180.' });
    if (Boolean(v.lat) !== Boolean(v.lng))
      ctx.addIssue({
        path: [v.lat ? 'lng' : 'lat'],
        code: 'custom',
        message: 'Enter both coordinates or neither.',
      });
  });

const TYPE_TONE = { country: 'navy', region: 'accent', city: 'info', neighborhood: 'neutral' };

function LocationFormModal({ open, onOpenChange, location, locations, defaultParent }) {
  const editing = Boolean(location?.id);
  const [slugTouched, setSlugTouched] = useState(editing);
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    const parent = defaultParent ? locations.find((l) => l.id === defaultParent) : null;
    const childType = parent
      ? Object.keys(LOCATION_TYPES).find((t) => LOCATION_TYPES[t].parentType === parent.type)
      : 'city';
    reset({
      name: location?.name ?? '',
      slug: location?.slug ?? '',
      type: location?.type ?? childType ?? 'city',
      parentId: location?.parentId ?? parent?.id ?? '',
      description: location?.description ?? '',
      lat: location?.lat != null ? String(location.lat) : '',
      lng: location?.lng != null ? String(location.lng) : '',
      active: location?.active ?? true,
    });
    setSlugTouched(editing);
  }, [open, location, locations, defaultParent, reset, editing]);

  const type = watch('type');
  const parentType = type ? LOCATION_TYPES[type]?.parentType : null;
  const parentOptions = locations.filter((l) => l.type === parentType && l.id !== location?.id);

  const save = useApiMutation(
    (v) => {
      const payload = {
        ...v,
        parentId: v.type === 'country' ? null : v.parentId,
        lat: v.lat ? Number(v.lat) : null,
        lng: v.lng ? Number(v.lng) : null,
      };
      return editing ? updateLocation(location.id, payload) : createLocation(payload);
    },
    {
      invalidate: [['locations'], ['listings']],
      success: (l) => (editing ? `Saved “${l.name}”` : `Created “${l.name}”`),
      error: 'Couldn’t save location',
      onSuccess: () => onOpenChange(false),
    },
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit location' : 'New location'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={handleSubmit((v) => save.mutate(v))}>
            {editing ? 'Save changes' : 'Create location'}
          </Button>
        </>
      }
    >
      <form noValidate onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Name"
          required
          error={errors.name?.message}
          {...register('name', {
            onChange: (e) => !slugTouched && setValue('slug', slugify(e.target.value)),
          })}
        />
        <TextField
          label="Slug"
          required
          error={errors.slug?.message}
          {...register('slug', { onChange: () => setSlugTouched(true) })}
        />
        <SelectField
          label="Location type"
          required
          options={Object.entries(LOCATION_TYPES).map(([v, t]) => ({ value: v, label: t.label }))}
          helper="Changing the type updates which parents are available."
          {...register('type', { onChange: () => setValue('parentId', '') })}
        />
        <SelectField
          label="Parent location"
          required={type !== 'country'}
          disabled={type === 'country'}
          placeholder={
            type === 'country'
              ? 'Not applicable'
              : parentOptions.length
                ? `Choose a ${LOCATION_TYPES[parentType]?.label.toLowerCase()}…`
                : 'No valid parents'
          }
          options={parentOptions.map((l) => ({ value: l.id, label: l.name }))}
          error={errors.parentId?.message}
          {...register('parentId')}
        />
        <TextAreaField
          label="Description"
          rows={2}
          className="sm:col-span-2"
          error={errors.description?.message}
          {...register('description')}
        />
        <TextField
          label="Latitude"
          inputMode="decimal"
          placeholder="13.1866"
          error={errors.lat?.message}
          {...register('lat')}
        />
        <TextField
          label="Longitude"
          inputMode="decimal"
          placeholder="-59.6375"
          error={errors.lng?.message}
          {...register('lng')}
        />
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <Toggle
              className="sm:col-span-2"
              label="Active"
              description="Inactive locations are hidden from public filters."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </form>
    </Modal>
  );
}

function TreeNode({ node, childrenOf, depth, selected, onSelect, expanded, setExpanded }) {
  const kids = childrenOf(node.id);
  const open = expanded.has(node.id);
  return (
    <li role="treeitem" aria-expanded={kids.length ? open : undefined} aria-selected={selected === node.id}>
      <div
        className={`flex items-center gap-1 rounded-lg pr-2 ${selected === node.id ? 'bg-accent/10' : 'hover:bg-subtle'}`}
        style={{ paddingLeft: depth * 14 }}
      >
        {kids.length ? (
          <button
            type="button"
            onClick={() =>
              setExpanded((s) => {
                const n = new Set(s);
                if (n.has(node.id)) n.delete(node.id);
                else n.add(node.id);
                return n;
              })
            }
            className="grid h-7 w-7 shrink-0 place-items-center rounded text-muted hover:text-ink"
            aria-label={`${open ? 'Collapse' : 'Expand'} ${node.name}`}
          >
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
              aria-hidden="true"
            />
          </button>
        ) : (
          <span className="w-7 shrink-0" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className={`flex min-w-0 flex-1 items-center justify-between gap-2 py-1.5 text-left text-sm ${node.active ? 'text-ink' : 'text-muted line-through'}`}
        >
          <span className="truncate">{node.name}</span>
          <span className="shrink-0 text-2xs tabular text-muted">{node.listingCount}</span>
        </button>
      </div>
      {kids.length > 0 && open && (
        <ul role="group">
          {kids.map((k) => (
            <TreeNode
              key={k.id}
              node={k}
              childrenOf={childrenOf}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              expanded={expanded}
              setExpanded={setExpanded}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function LocationsPage() {
  const { data: locations = [], isPending, isError, error, refetch } = useApiQuery('locations', getLocations);
  const listings = useApiQuery('listings', getListings);
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(
    () => new Set(['loc-barbados', 'loc-christ-church', 'loc-st-james']),
  );
  const confirm = useConfirm();
  const byId = useMemo(() => Object.fromEntries(locations.map((l) => [l.id, l])), [locations]);
  const childrenOf = (id) =>
    locations.filter((l) => l.parentId === id).sort((a, b) => a.name.localeCompare(b.name));

  const config = useMemo(
    () => ({
      searchFields: (l) => [l.name, l.slug, l.description],
      filters: {
        type: (l, v) => l.type === v,
        visibility: (l, v) => (v === 'active' ? l.active : !l.active),
        parent: (l, v) => l.parentId === v,
      },
      sorters: {
        name: (l) => l.name,
        type: (l) => Object.keys(LOCATION_TYPES).indexOf(l.type),
        listings: (l) => l.listingCount,
      },
      defaultSort: { key: 'type', dir: 'asc' },
    }),
    [],
  );
  const t = useTableState(locations, config);

  const setView = (id) =>
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      if (id) n.set('view', id);
      else n.delete('view');
      return n;
    });
  const viewing = byId[params.get('view')] ?? null;
  const viewListings = (listings.data ?? []).filter(
    (l) =>
      viewing &&
      [l.location.countryId, l.location.regionId, l.location.cityId, l.location.neighborhoodId].includes(
        viewing.id,
      ),
  );

  const toggle = useApiMutation(
    ({ listingCount: _lc, childCount: _cc, ...l }) => updateLocation(l.id, { ...l, active: !l.active }),
    {
      invalidate: [['locations']],
      success: (l) => `“${l.name}” is now ${l.active ? 'active' : 'inactive'}`,
      error: 'Couldn’t update location',
    },
  );
  const remove = useApiMutation((id) => deleteLocation(id), {
    invalidate: [['locations']],
    success: 'Location deleted',
    error: 'Delete blocked',
    onSuccess: () => setView(null),
  });

  const askDelete = async (l) => {
    if (
      await confirm({
        title: `Delete “${l.name}”?`,
        message:
          l.childCount || l.listingCount
            ? `It has ${l.childCount} child location(s) and ${l.listingCount} listing(s); the demo service will refuse until those are moved.`
            : 'This can’t be undone.',
        confirmLabel: 'Delete',
        tone: 'danger',
      })
    )
      remove.mutate(l.id);
  };

  const menu = (l) => [
    { label: 'View', icon: Eye, onSelect: () => setView(l.id) },
    { label: 'Edit', icon: Pencil, onSelect: () => setEditing({ location: l }) },
    l.type !== 'neighborhood' && {
      label: 'Add child location',
      icon: Plus,
      onSelect: () => setEditing({ parent: l.id }),
    },
    { label: l.active ? 'Deactivate' : 'Activate', icon: Power, onSelect: () => toggle.mutate(l) },
    { label: 'Delete', icon: Trash2, tone: 'danger', separatorBefore: true, onSelect: () => askDelete(l) },
  ];

  return (
    <>
      <PageHeader
        title="Locations"
        description="Country → island or region → city or town → neighbourhood. Listings reference these locations."
        actions={
          <Button icon={Plus} onClick={() => setEditing({})}>
            New location
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="lg:sticky lg:top-24 lg:self-start">
          <CardHeader title="Hierarchy" description="Select a location to see its details." />
          {isPending ? (
            <LoadingState rows={6} />
          ) : (
            <ul role="tree" aria-label="Location hierarchy" className="-mx-2 max-h-[60vh] overflow-y-auto">
              {locations
                .filter((l) => !l.parentId)
                .map((root) => (
                  <TreeNode
                    key={root.id}
                    node={root}
                    childrenOf={childrenOf}
                    depth={0}
                    selected={viewing?.id}
                    onSelect={setView}
                    expanded={expanded}
                    setExpanded={setExpanded}
                  />
                ))}
            </ul>
          )}
        </Card>
        <Card padded={false} className="min-w-0">
          <FilterBar
            chips={[
              t.q && { key: 'q', label: `Search: “${t.q}”`, onRemove: () => t.setQ('') },
              t.filterValues.type && {
                key: 't',
                label: LOCATION_TYPES[t.filterValues.type].label,
                onRemove: () => t.setFilter('type', ''),
              },
              t.filterValues.parent && {
                key: 'p',
                label: `In ${byId[t.filterValues.parent]?.name}`,
                onRemove: () => t.setFilter('parent', ''),
              },
              t.filterValues.visibility && {
                key: 'v',
                label: t.filterValues.visibility,
                onRemove: () => t.setFilter('visibility', ''),
              },
            ].filter(Boolean)}
            onReset={t.resetAll}
          >
            <SearchInput
              value={t.q}
              onChange={t.setQ}
              label="Search locations"
              placeholder="Search locations"
              className="lg:w-60"
            />
            <SelectField
              label="Type"
              placeholder="All types"
              options={Object.entries(LOCATION_TYPES).map(([v, x]) => ({ value: v, label: x.label }))}
              value={t.filterValues.type}
              onValueChange={(v) => t.setFilter('type', v)}
            />
            <SelectField
              label="Parent"
              placeholder="Any parent"
              options={locations
                .filter((l) => l.type !== 'neighborhood')
                .map((l) => ({ value: l.id, label: l.name }))}
              value={t.filterValues.parent}
              onValueChange={(v) => t.setFilter('parent', v)}
            />
            <SelectField
              label="Visibility"
              placeholder="All"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              value={t.filterValues.visibility}
              onValueChange={(v) => t.setFilter('visibility', v)}
            />
          </FilterBar>
          <DataTable
            caption="Locations"
            loading={isPending}
            error={isError ? error : null}
            onRetry={refetch}
            rows={t.pageItems}
            sort={{ key: t.sortKey, dir: t.sortDir, onSort: t.setSort }}
            empty={{ icon: MapPin, title: 'No locations found' }}
            columns={[
              {
                key: 'name',
                header: 'Location',
                sortKey: 'name',
                cell: (l) => (
                  <button
                    type="button"
                    onClick={() => setView(l.id)}
                    className="font-medium text-ink hover:text-accent-600"
                  >
                    {l.name}
                  </button>
                ),
              },
              {
                key: 'type',
                header: 'Type',
                sortKey: 'type',
                cell: (l) => (
                  <Badge tone={TYPE_TONE[l.type] === 'navy' ? 'neutral' : TYPE_TONE[l.type]}>
                    {LOCATION_TYPES[l.type].label}
                  </Badge>
                ),
              },
              {
                key: 'parent',
                header: 'Parent',
                hideBelow: 'md',
                cell: (l) => <span className="text-muted">{byId[l.parentId]?.name ?? '—'}</span>,
              },
              {
                key: 'listings',
                header: 'Listings',
                sortKey: 'listings',
                align: 'right',
                cell: (l) =>
                  l.listingCount ? (
                    <Link
                      className="font-medium text-accent-600 hover:underline"
                      to={`/listings?location=${l.id}`}
                    >
                      {l.listingCount}
                    </Link>
                  ) : (
                    <span className="text-muted">0</span>
                  ),
              },
              {
                key: 'visibility',
                header: 'Visibility',
                hideBelow: 'sm',
                cell: (l) => (
                  <Badge tone={l.active ? 'success' : 'muted'} dot>
                    {l.active ? 'Active' : 'Inactive'}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                cell: (l) => (
                  <DropdownMenu
                    label={`Actions for ${l.name}`}
                    items={menu(l)}
                    trigger={
                      <IconButton label={`Actions for ${l.name}`} icon={MoreHorizontal} tooltip={false} />
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
            label="locations"
          />
        </Card>
      </div>

      <LocationFormModal
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        location={editing?.location}
        defaultParent={editing?.parent}
        locations={locations}
      />

      <Drawer
        open={Boolean(viewing)}
        onOpenChange={(o) => !o && setView(null)}
        title={viewing?.name ?? ''}
        description={
          viewing
            ? `${LOCATION_TYPES[viewing.type].label}${viewing.parentId ? ` in ${byId[viewing.parentId]?.name}` : ''}`
            : ''
        }
        footer={
          viewing && (
            <>
              <Button variant="outline" icon={Pencil} onClick={() => setEditing({ location: viewing })}>
                Edit
              </Button>
              <Button to={`/listings?location=${viewing.id}`}>View listings</Button>
            </>
          )
        }
      >
        {viewing && (
          <div className="space-y-5 text-sm">
            <p className="text-muted">{viewing.description || 'No description.'}</p>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted">Slug</dt>
                <dd>
                  <code>{viewing.slug}</code>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Status</dt>
                <dd>{viewing.active ? 'Active' : 'Inactive'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Coordinates</dt>
                <dd>{viewing.lat != null ? `${viewing.lat}, ${viewing.lng}` : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Child locations</dt>
                <dd>
                  {childrenOf(viewing.id)
                    .map((c) => c.name)
                    .join(', ') || '—'}
                </dd>
              </div>
            </dl>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Associated listings ({viewListings.length})
              </h3>
              {viewListings.length ? (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {viewListings.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <Link to={`/listings/${l.id}`} className="truncate font-medium hover:text-accent-600">
                        {l.name}
                      </Link>
                      <ListingStatusBadge status={l.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">No listings in this location.</p>
              )}
            </section>
          </div>
        )}
      </Drawer>
    </>
  );
}
