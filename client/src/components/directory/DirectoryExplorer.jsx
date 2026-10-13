import { lazy, Suspense, useCallback, useState } from 'react';
import { LayoutGrid, List, Map as MapIcon, SlidersHorizontal } from 'lucide-react';
import { useBusinessSearch } from '@/hooks/useBusinessSearch';
import { useDirectorySearch } from '@/hooks/useBusinesses';
import { Drawer } from '@/components/common/Overlays';
import { Button } from '@/components/common/Button';
import { ErrorState, LoadingSpinner } from '@/components/common/States';
import { BusinessGridSkeleton } from '@/components/common/Skeleton';
import { DirectorySearch } from './DirectorySearch';
import { DirectoryFilters } from './DirectoryFilters';
import { ActiveFilters } from './ActiveFilters';
import { SortDropdown } from './SortDropdown';
import { BusinessList } from './BusinessList';
import { Pagination } from './Pagination';
import { DirectoryEmptyState } from './DirectoryEmptyState';

const BusinessMap = lazy(() => import('./BusinessMap'));

const VIEWS = [
  { value: 'grid', label: 'Grid view', icon: LayoutGrid },
  { value: 'list', label: 'List view', icon: List },
  { value: 'map', label: 'Map view', icon: MapIcon },
];

/**
 * The full searchable directory: search, filters (sidebar on desktop, drawer on mobile),
 * active filter chips, sorting, grid/list/map views, pagination and all data states.
 * All state lives in the URL. `fixed` locks a category or location for landing pages.
 */
export function DirectoryExplorer({ fixed = {}, searchPlaceholder, anchorId = 'results' }) {
  const { filters, update, clearAll, activeCount, params } = useBusinessSearch({ fixed });
  const query = useDirectorySearch(filters);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState(filters);

  const view = VIEWS.some((v) => v.value === params.get('view')) ? params.get('view') : 'grid';
  const lockCategory = Boolean(fixed.category);
  const lockLocation = Boolean(fixed.location);

  const onSearch = useCallback((q, opts) => update({ q }, opts), [update]);
  const setView = (v) => update({ view: v === 'grid' ? '' : v, page: filters.page });
  const setPage = (p) => {
    update({ page: p });
    document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const clearFilters = () => {
    if (lockCategory || lockLocation)
      update({ q: '', category: '', location: '', type: '', amenities: [], featured: false });
    else clearAll();
  };

  const data = query.data;
  const facets = data?.facets;
  const total = data?.total ?? 0;
  const showingFrom = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const showingTo = data ? Math.min(data.page * data.pageSize, total) : 0;

  return (
    <div id={anchorId} className="scroll-mt-28">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <DirectorySearch
          value={filters.q}
          onSearch={onSearch}
          placeholder={searchPlaceholder}
          className="flex-1"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="lg:hidden"
            onClick={() => {
              setDraft(filters);
              setDrawerOpen(true);
            }}
            iconLeft={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
          >
            Filters
            {activeCount > 0 && (
              <span className="ml-1 inline-grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1.5 text-xs text-navy-900">
                {activeCount}
              </span>
            )}
          </Button>
          <SortDropdown
            value={filters.sort}
            onChange={(sort) => update({ sort })}
            className="ml-auto lg:ml-0"
          />
          <div
            role="group"
            aria-label="Results view"
            className="hidden items-center rounded-full border border-line bg-white p-1 sm:flex"
          >
            {VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => setView(v.value)}
                aria-pressed={view === v.value}
                aria-label={v.label}
                title={v.label}
                className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${view === v.value ? 'bg-navy text-white' : 'text-navy hover:bg-sand'}`}
              >
                <v.icon className="h-4 w-4" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[280px_1fr]">
        {/* Desktop filters */}
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-card border border-line bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Filters</h2>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-bold text-ocean-700 hover:underline"
                >
                  Clear all ({activeCount})
                </button>
              )}
            </div>
            <DirectoryFilters
              value={filters}
              onChange={update}
              facets={facets}
              lockCategory={lockCategory}
              lockLocation={lockLocation}
            />
          </div>
        </aside>

        {/* Results */}
        <section aria-labelledby={`${anchorId}-heading`} className="min-w-0">
          <div className="mb-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id={`${anchorId}-heading`}
                className="text-lg font-extrabold"
                aria-live="polite"
                aria-atomic="true"
              >
                {query.isPending
                  ? 'Searching…'
                  : `${total} ${total === 1 ? 'business' : 'businesses'} found`}
                {data?.interpretedLocation && !filters.location && (
                  <span className="ml-2 text-sm font-semibold text-muted">
                    in {data.interpretedLocation}
                  </span>
                )}
              </h2>
              {total > 0 && data.pageCount > 1 && (
                <p className="text-sm font-semibold text-muted">
                  Showing {showingFrom}–{showingTo}
                </p>
              )}
            </div>
            <ActiveFilters
              filters={filters}
              onChange={update}
              onClearAll={clearFilters}
              lockCategory={lockCategory}
              lockLocation={lockLocation}
            />
          </div>

          <div
            className={`transition-opacity duration-200 ${query.isPlaceholderData ? 'opacity-60' : ''}`}
            aria-busy={query.isFetching}
          >
            {query.isPending ? (
              <BusinessGridSkeleton count={6} layout={view === 'list' ? 'list' : 'grid'} />
            ) : query.isError ? (
              <ErrorState
                title="We couldn’t load businesses"
                message={query.error?.message}
                onRetry={() => query.refetch()}
                retrying={query.isFetching}
              />
            ) : total === 0 ? (
              <DirectoryEmptyState
                filters={filters}
                facets={facets}
                onChange={update}
                onClearAll={clearFilters}
                lockCategory={lockCategory}
                lockLocation={lockLocation}
              />
            ) : view === 'map' ? (
              <div className="grid gap-6">
                <Suspense
                  fallback={
                    <LoadingSpinner
                      label="Loading map…"
                      className="h-[380px] rounded-card bg-sand md:h-[460px]"
                    />
                  }
                >
                  <BusinessMap businesses={data.items} className="h-[380px] md:h-[460px]" />
                </Suspense>
                <BusinessList businesses={data.items} layout="grid" />
              </div>
            ) : (
              <BusinessList businesses={data.items} layout={view} />
            )}
          </div>

          {data && total > 0 && (
            <Pagination
              page={data.page}
              pageCount={data.pageCount}
              onChange={setPage}
              className="mt-12"
            />
          )}
        </section>
      </div>

      {/* Mobile filter drawer with Apply / Reset */}
      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Filters"
        footer={
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  category: lockCategory ? d.category : '',
                  location: lockLocation ? d.location : '',
                  type: '',
                  amenities: [],
                  featured: false,
                }))
              }
            >
              Reset
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                update({
                  category: lockCategory ? undefined : draft.category,
                  location: lockLocation ? undefined : draft.location,
                  type: draft.type,
                  amenities: draft.amenities,
                  featured: draft.featured,
                });
                setDrawerOpen(false);
              }}
            >
              Apply filters
            </Button>
          </div>
        }
      >
        <div className="p-5">
          <DirectoryFilters
            value={draft}
            onChange={(changes) => setDraft((d) => ({ ...d, ...changes }))}
            facets={facets}
            lockCategory={lockCategory}
            lockLocation={lockLocation}
          />
        </div>
      </Drawer>
    </div>
  );
}
