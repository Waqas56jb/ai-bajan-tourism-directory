export const formatNumber = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : '—');

export function formatCompact(n) {
  if (typeof n !== 'number') return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export const formatPercent = (n, digits = 0) =>
  typeof n === 'number' ? `${(n * 100).toFixed(digits)}%` : '—';

export function formatMs(ms) {
  if (typeof ms !== 'number') return '—';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function formatBytes(bytes) {
  if (typeof bytes !== 'number') return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

/** Fractional change between two periods; null when there is no baseline. */
export function percentChange(current, previous) {
  if (typeof current !== 'number' || typeof previous !== 'number' || previous === 0) return null;
  return (current - previous) / previous;
}
