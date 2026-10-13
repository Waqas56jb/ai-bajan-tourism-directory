export function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded-xl ${className}`} aria-hidden="true" />;
}

export function BusinessCardSkeleton({ layout = 'grid' }) {
  if (layout === 'list') {
    return (
      <div className="flex gap-4 rounded-card border border-line bg-white p-3" aria-hidden="true">
        <Skeleton className="aspect-[4/3] w-36 shrink-0 sm:w-56" />
        <div className="flex-1 space-y-3 py-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-card border border-line bg-white" aria-hidden="true">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function BusinessGridSkeleton({ count = 6, layout = 'grid' }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading businesses…</span>
      <div
        className={layout === 'list' ? 'grid gap-4' : 'grid gap-6 sm:grid-cols-2 xl:grid-cols-3'}
      >
        {Array.from({ length: count }, (_, i) => (
          <BusinessCardSkeleton key={i} layout={layout} />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="container-page py-16" role="status" aria-live="polite">
      <span className="sr-only">Loading page…</span>
      <Skeleton className="mb-6 h-5 w-48" />
      <Skeleton className="mb-4 h-12 w-3/4 max-w-2xl" />
      <Skeleton className="mb-10 h-5 w-1/2 max-w-xl" />
      <Skeleton className="aspect-[16/7] w-full" />
    </div>
  );
}
