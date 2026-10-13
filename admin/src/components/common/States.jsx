import { Inbox, RefreshCw, TriangleAlert, FlaskConical } from 'lucide-react';
import { Button } from './Button';

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
  compact = false,
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-14'} ${className}`}
    >
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-subtle text-muted">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Couldn’t load this data',
  message,
  onRetry,
  retrying,
  className = '',
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}
    >
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-danger/10 text-danger">
        <TriangleAlert className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>}
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          icon={RefreshCw}
          onClick={onRetry}
          loading={retrying}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Generic loading block: `rows` skeleton lines, announced to screen readers. */
export function LoadingState({ rows = 5, label = 'Loading…', className = '' }) {
  return (
    <div role="status" aria-live="polite" className={`space-y-3 p-5 ${className}`}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i % 3 === 0 ? 'w-2/3' : i % 3 === 1 ? 'w-full' : 'w-5/6'}`} />
      ))}
    </div>
  );
}

export function PageLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading page…</span>
      <Skeleton className="h-7 w-56" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-card" />
    </div>
  );
}

/** Inline notice explaining demo-only behaviour. */
export function DemoNotice({ children, className = '', title = 'Demo mode' }) {
  return (
    <div
      className={`flex gap-3 rounded-xl border border-sand/50 bg-sand/10 px-4 py-3 text-sm ${className}`}
      role="note"
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-sand-600" aria-hidden="true" />
      <div className="text-ink">
        <span className="font-semibold">{title}: </span>
        <span className="text-muted">{children}</span>
      </div>
    </div>
  );
}
