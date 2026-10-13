import { Star } from 'lucide-react';

/**
 * Shows a rating only when it is genuine, sourced data: a numeric `rating`, a `count` and a
 * `source` must all be present. Otherwise renders nothing. (The demo dataset has no ratings.)
 */
export function RatingDisplay({ rating, count, source, className = '' }) {
  if (typeof rating !== 'number' || !count || !source) return null;
  const rounded = Math.round(rating * 10) / 10;
  return (
    <p className={`inline-flex items-center gap-1.5 text-sm font-semibold text-ink ${className}`}>
      <Star className="h-4 w-4 fill-coral text-coral" aria-hidden="true" />
      <span>
        {rounded.toFixed(1)}
        <span className="sr-only"> out of 5</span>
      </span>
      <span className="font-medium text-muted">
        ({count.toLocaleString()} {count === 1 ? 'review' : 'reviews'} on {source})
      </span>
    </p>
  );
}
