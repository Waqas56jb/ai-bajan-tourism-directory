import { useState } from 'react';
import { ImageOff, Loader2, Trash2 } from 'lucide-react';

const FALLBACK = '/image-fallback.svg';

/** Image that never shows a broken icon: shows a loading shimmer, then a fallback on error. */
export function ImageWithFallback({ src, alt = '', className = '', imgClassName = '' }) {
  const [state, setState] = useState(src ? 'loading' : 'error');
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setState(src ? 'loading' : 'error');
  }
  return (
    <div className={`relative overflow-hidden bg-subtle ${className}`}>
      {state === 'loading' && <div className="skeleton absolute inset-0 rounded-none" aria-hidden="true" />}
      <img
        src={state === 'error' ? FALLBACK : src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setState((s) => (s === 'loading' ? 'loaded' : s))}
        onError={() => setState('error')}
        className={`h-full w-full object-cover ${imgClassName}`}
      />
    </div>
  );
}

/**
 * Preview tile for a chosen image (URL or local object URL). Shows load/error states and a
 * remove action. Nothing is uploaded to a server in the demo.
 */
export function ImageUploadPreview({ src, alt, onRemove, label = 'image', className = 'aspect-[4/3]' }) {
  const [status, setStatus] = useState('loading');
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setStatus('loading');
  }
  return (
    <figure className={`group relative overflow-hidden rounded-xl border border-line bg-subtle ${className}`}>
      {status !== 'error' ? (
        <img
          src={src}
          alt={alt || ''}
          className="h-full w-full object-cover"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center text-xs text-muted">
          <ImageOff className="h-5 w-5" aria-hidden="true" />
          Image couldn’t be loaded. Check the URL.
        </div>
      )}
      {status === 'loading' && (
        <div className="absolute inset-0 grid place-items-center bg-subtle">
          <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label="Loading image" />
        </div>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-surface/95 text-danger shadow-card hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`Remove ${label}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </figure>
  );
}
