import { Compass, RotateCcw, TriangleAlert, Loader2 } from 'lucide-react';
import { Button } from './Button';

/** Failed request / failed section. Shows retry only when retrying makes sense. */
export function ErrorState({
  title = 'Something went wrong',
  message = 'We couldn’t load this content. Please try again.',
  onRetry,
  retrying = false,
  action,
  className = '',
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center rounded-card border border-coral/30 bg-white px-6 py-12 text-center ${className}`}
    >
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-coral/15 text-coral-600">
        <TriangleAlert className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="text-xl font-extrabold">{title}</h2>
      <p className="mt-2 max-w-md text-muted">{message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {onRetry && (
          <Button
            variant="primary"
            onClick={onRetry}
            loading={retrying}
            iconLeft={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
          >
            Try again
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: IconComponent = Compass,
  title,
  message,
  children,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-card border border-dashed border-navy/20 bg-white/70 px-6 py-14 text-center ${className}`}
    >
      <span className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-sand text-ocean-700">
        <IconComponent className="h-8 w-8" aria-hidden="true" />
      </span>
      <h2 className="text-2xl font-extrabold">{title}</h2>
      {message && <div className="mt-2 max-w-lg text-muted">{message}</div>}
      {children && <div className="mt-7 w-full">{children}</div>}
    </div>
  );
}

export function LoadingSpinner({ label = 'Loading…', className = '' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-3 py-10 text-muted ${className}`}
    >
      <Loader2 className="h-5 w-5 animate-spin text-ocean" aria-hidden="true" />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}
