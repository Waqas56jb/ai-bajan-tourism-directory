import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, FolderTree, MoreHorizontal, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useTableState';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/services/categoryService';
import { getListings } from '@/services/listingService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
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
import { CategoryIcon, CATEGORY_ICONS } from '@/components/common/CategoryIcon';
import { ImageUploadPreview } from '@/components/common/ImageUploadPreview';
import { ListingStatusBadge } from '@/components/listings/ListingStatusBadge';
import { formatDate } from '@/utils/formatDate';
import { slugify, SLUG_PATTERN, isValidUrl } from '@/utils/validation';

const schema = z.object({
  name: z.string().trim().min(2, 'Name is required.').max(60),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug is required.')
    .regex(SLUG_PATTERN, 'Lowercase letters, numbers and hyphens only.'),
  description: z.string().trim().max(240, 'Keep it under 240 characters.'),
  icon: z.string().min(1),
  image: z
    .string()
    .trim()
    .refine((v) => !v || isValidUrl(v), 'Enter a full image URL.'),
  parentId: z.string(),
  order: z.coerce.number().int().min(1, 'Must be 1 or more.').max(999),
  active: z.boolean(),
});

function CategoryFormModal({ open, onOpenChange, category, categories }) {
  const editing = Boolean(category?.id);
  const [slugTouched, setSlugTouched] = useState(editing);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({
        name: category?.name ?? '',
        slug: category?.slug ?? '',
        description: category?.description ?? '',
        icon: category?.icon ?? 'Sparkles',
        image: category?.image ?? '',
        parentId: category?.parentId ?? '',
        order: category?.order ?? categories.length + 1,
        active: category?.active ?? true,
      });
      setSlugTouched(editing);
    }
  }, [open, category, categories.length, reset, editing]);

  const save = useApiMutation(
    (values) => (editing ? updateCategory(category.id, values) : createCategory(values)),
    {
      invalidate: [['categories'], ['listings']],
      success: (c) => (editing ? `Saved “${c.name}”` : `Created “${c.name}”`),
      error: 'Couldn’t save category',
      onSuccess: () => onOpenChange(false),
    },
  );

  const values = watch();
  const parents = categories.filter((c) => !c.parentId && c.id !== category?.id);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit category' : 'New category'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit((v) =>
              save.mutate({ ...v, parentId: v.parentId || null, image: v.image || null }),
            )}
            loading={save.isPending}
          >
            {editing ? 'Save changes' : 'Create category'}
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
          helper="Used in /category/… URLs."
          {...register('slug', { onChange: () => setSlugTouched(true) })}
        />
        <TextAreaField
          label="Description"
          rows={2}
          maxLength={240}
          value={values.description}
          error={errors.description?.message}
          className="sm:col-span-2"
          {...register('description')}
        />
        <fieldset className="sm:col-span-2">
          <legend className="label">Icon</legend>
          <Controller
            control={control}
            name="icon"
            render={({ field }) => (
              <div role="radiogroup" aria-label="Category icon" className="flex flex-wrap gap-1.5">
                {Object.keys(CATEGORY_ICONS).map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={field.value === name}
                    aria-label={name}
                    onClick={() => field.onChange(name)}
                    className={`grid h-9 w-9 place-items-center rounded-lg border transition-colors ${field.value === name ? 'border-accent bg-accent/10 text-accent-600' : 'border-line text-muted hover:text-ink'}`}
                  >
                    <CategoryIcon name={name} />
                  </button>
                ))}
              </div>
            )}
          />
        </fieldset>
        <SelectField
          label="Parent category"
          placeholder="None (top level)"
          options={parents.map((c) => ({ value: c.id, label: c.name }))}
          {...register('parentId')}
        />
        <TextField
          label="Display order"
          type="number"
          min={1}
          error={errors.order?.message}
          {...register('order')}
        />
        <div className="sm:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
          <TextField
            label="Image URL (optional)"
            type="url"
            placeholder="https://"
            error={errors.image?.message}
            {...register('image')}
          />
          {values.image && isValidUrl(values.image) && (
            <ImageUploadPreview
              src={values.image}
              alt=""
              label="category image"
              onRemove={() => setValue('image', '')}
            />
          )}
        </div>
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <Toggle
              className="sm:col-span-2"
              label="Active"
              description="Inactive categories are hidden from the public site."
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </form>
    </Modal>
  );
}

function ReassignModal({ target, categories, onClose }) {
  const [to, setTo] = useState('');
  const remove = useApiMutation(() => deleteCategory(target.id, { reassignTo: to }), {
    invalidate: [['categories'], ['listings']],
    success: `Deleted “${target?.name}” and reassigned its listings`,
    error: 'Delete failed',
    onSuccess: onClose,
  });
  return (
    <Modal
      open={Boolean(target)}
      onOpenChange={(o) => !o && onClose()}
      title={`Reassign listings before deleting “${target?.name}”`}
      description={`${target?.listingCount} listing(s) use this category. Choose where to move them — nothing is removed silently.`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!to}
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Reassign and delete
          </Button>
        </>
      }
    >
      <SelectField
        label="Move listings to"
        required
        placeholder="Choose a category…"
        options={categories.filter((c) => c.id !== target?.id).map((c) => ({ value: c.id, label: c.name }))}
        value={to}
        onValueChange={setTo}
      />
    </Modal>
  );
}

export default function CategoriesPage() {
  const {
    data: categories = [],
    isPending,
    isError,
    error,
    refetch,
  } = useApiQuery('categories', getCategories);
  const listings = useApiQuery('listings', getListings);
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(null); // {} for new
  const [reassign, setReassign] = useState(null);
  const confirm = useConfirm();
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const config = useMemo(
    () => ({
      searchFields: (c) => [c.name, c.slug, c.description],
      filters: {
        visibility: (c, v) => (v === 'active' ? c.active : !c.active),
        level: (c, v) => (v === 'top' ? !c.parentId : Boolean(c.parentId)),
      },
      sorters: {
        name: (c) => c.name,
        order: (c) => c.order,
        listings: (c) => c.listingCount,
        updatedAt: (c) => new Date(c.updatedAt).getTime(),
      },
      defaultSort: { key: 'order', dir: 'asc' },
    }),
    [],
  );
  const t = useTableState(categories, config);

  const toggle = useApiMutation((c) => updateCategory(c.id, { active: !c.active }), {
    invalidate: [['categories']],
    success: (c) => `“${c.name}” is now ${c.active ? 'active' : 'inactive'}`,
    error: 'Couldn’t update category',
  });
  const remove = useApiMutation((id) => deleteCategory(id), {
    invalidate: [['categories']],
    success: 'Category deleted',
    error: 'Delete blocked',
  });

  const setView = (id) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('view', id);
      else next.delete('view');
      return next;
    });
  const viewId = params.get('view');
  const viewing = viewId ? catById[viewId] : null;
  const viewListings = (listings.data ?? []).filter(
    (l) => viewing && (l.categoryId === viewing.id || l.secondaryCategoryIds?.includes(viewing.id)),
  );

  const askDelete = async (c) => {
    if (categories.some((x) => x.parentId === c.id)) {
      await confirm({
        title: 'Can’t delete yet',
        message: `“${c.name}” has subcategories. Move or delete them first.`,
        confirmLabel: 'OK',
      });
      return;
    }
    if (c.listingCount > 0) return setReassign(c);
    if (
      await confirm({
        title: `Delete “${c.name}”?`,
        message: 'No listings use this category. This can’t be undone.',
        confirmLabel: 'Delete',
        tone: 'danger',
      })
    )
      remove.mutate(c.id);
  };

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organise listings into categories shown on the public site and used by chatbot retrieval."
        actions={
          <Button icon={Plus} onClick={() => setEditing({})}>
            New category
          </Button>
        }
      />
      <Card padded={false}>
        <FilterBar
          chips={[
            t.q && { key: 'q', label: `Search: “${t.q}”`, onRemove: () => t.setQ('') },
            t.filterValues.visibility && {
              key: 'v',
              label: t.filterValues.visibility === 'active' ? 'Active' : 'Inactive',
              onRemove: () => t.setFilter('visibility', ''),
            },
            t.filterValues.level && {
              key: 'l',
              label: t.filterValues.level === 'top' ? 'Top level' : 'Subcategories',
              onRemove: () => t.setFilter('level', ''),
            },
          ].filter(Boolean)}
          onReset={t.resetAll}
        >
          <SearchInput
            value={t.q}
            onChange={t.setQ}
            label="Search categories"
            placeholder="Name, slug or description"
            className="lg:w-72"
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
          <SelectField
            label="Level"
            placeholder="All"
            options={[
              { value: 'top', label: 'Top level' },
              { value: 'sub', label: 'Subcategories' },
            ]}
            value={t.filterValues.level}
            onValueChange={(v) => t.setFilter('level', v)}
          />
        </FilterBar>
        <DataTable
          caption="Categories"
          loading={isPending}
          error={isError ? error : null}
          onRetry={refetch}
          rows={t.pageItems}
          sort={{ key: t.sortKey, dir: t.sortDir, onSort: t.setSort }}
          empty={{
            icon: FolderTree,
            title: 'No categories found',
            action: (
              <Button size="sm" variant="outline" onClick={t.resetAll}>
                Reset filters
              </Button>
            ),
          }}
          columns={[
            {
              key: 'order',
              header: '#',
              sortKey: 'order',
              width: 48,
              cell: (c) => <span className="tabular text-muted">{c.order}</span>,
            },
            {
              key: 'name',
              header: 'Category',
              sortKey: 'name',
              cell: (c) => (
                <button
                  type="button"
                  onClick={() => setView(c.id)}
                  className="flex min-w-[12rem] items-center gap-3 text-left"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent-600">
                    <CategoryIcon name={c.icon} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink hover:text-accent-600">
                      {c.name}
                    </span>
                    {c.parentId && (
                      <span className="block truncate text-xs text-muted">
                        in {catById[c.parentId]?.name}
                      </span>
                    )}
                  </span>
                </button>
              ),
            },
            {
              key: 'slug',
              header: 'Slug',
              hideBelow: 'md',
              cell: (c) => <code className="text-xs text-muted">{c.slug}</code>,
            },
            {
              key: 'description',
              header: 'Description',
              hideBelow: 'xl',
              cell: (c) => <p className="line-clamp-2 max-w-xs text-xs text-muted">{c.description}</p>,
            },
            {
              key: 'listings',
              header: 'Listings',
              sortKey: 'listings',
              align: 'right',
              cell: (c) =>
                c.listingCount ? (
                  <Link
                    to={`/listings?category=${c.id}`}
                    className="font-medium text-accent-600 hover:underline"
                  >
                    {c.listingCount}
                  </Link>
                ) : (
                  <span className="text-muted">0</span>
                ),
            },
            {
              key: 'visibility',
              header: 'Visibility',
              cell: (c) => (
                <Badge tone={c.active ? 'success' : 'muted'} dot>
                  {c.active ? 'Active' : 'Inactive'}
                </Badge>
              ),
            },
            {
              key: 'updated',
              header: 'Updated',
              sortKey: 'updatedAt',
              hideBelow: 'lg',
              cell: (c) => <span className="whitespace-nowrap text-muted">{formatDate(c.updatedAt)}</span>,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (c) => (
                <DropdownMenu
                  label={`Actions for ${c.name}`}
                  trigger={
                    <IconButton label={`Actions for ${c.name}`} icon={MoreHorizontal} tooltip={false} />
                  }
                  items={[
                    { label: 'View', icon: Eye, onSelect: () => setView(c.id) },
                    { label: 'Edit', icon: Pencil, onSelect: () => setEditing(c) },
                    {
                      label: c.active ? 'Deactivate' : 'Activate',
                      icon: Power,
                      onSelect: () => toggle.mutate(c),
                    },
                    {
                      label: 'Delete',
                      icon: Trash2,
                      tone: 'danger',
                      separatorBefore: true,
                      onSelect: () => askDelete(c),
                    },
                  ]}
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
          label="categories"
        />
      </Card>

      <CategoryFormModal
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        category={editing?.id ? editing : null}
        categories={categories}
      />
      {reassign && (
        <ReassignModal target={reassign} categories={categories} onClose={() => setReassign(null)} />
      )}

      <Drawer
        open={Boolean(viewing)}
        onOpenChange={(o) => !o && setView(null)}
        title={viewing?.name ?? ''}
        description={viewing?.description}
        footer={
          viewing && (
            <>
              <Button variant="outline" icon={Pencil} onClick={() => setEditing(viewing)}>
                Edit
              </Button>
              <Button to={`/listings?category=${viewing.id}`}>Open in listings</Button>
            </>
          )
        }
      >
        {viewing && (
          <div className="space-y-5 text-sm">
            {viewing.image && <ImageUploadPreview src={viewing.image} alt="" className="aspect-[16/9]" />}
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted">Slug</dt>
                <dd>
                  <code>{viewing.slug}</code>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Visibility</dt>
                <dd>{viewing.active ? 'Active' : 'Inactive'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Parent</dt>
                <dd>{viewing.parentId ? catById[viewing.parentId]?.name : 'Top level'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Display order</dt>
                <dd>{viewing.order}</dd>
              </div>
            </dl>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Listings ({viewListings.length})
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
                <p className="text-muted">No listings use this category.</p>
              )}
            </section>
          </div>
        )}
      </Drawer>
    </>
  );
}
