import { FlaskConical } from 'lucide-react';

const TONES = {
  success: 'bg-success/10 text-success ring-success/20',
  warning: 'bg-warning/10 text-warning ring-warning/25',
  danger: 'bg-danger/10 text-danger ring-danger/20',
  info: 'bg-info/10 text-info ring-info/20',
  accent: 'bg-accent/10 text-accent-600 ring-accent/20',
  sand: 'bg-sand/20 text-sand-600 ring-sand/40',
  neutral: 'bg-subtle text-ink ring-line',
  muted: 'bg-subtle text-muted ring-line',
};

/** Small label. Status badges include a dot + text so meaning never relies on colour alone. */
export function Badge({ tone = 'neutral', children, dot = false, className = '', icon: Icon }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Badge driven by a status vocabulary from utils/constants ({ key: { label, tone } }). */
export function StatusBadge({ status, map, className = '' }) {
  const entry = map[status] ?? { label: status ?? 'Unknown', tone: 'neutral' };
  return (
    <Badge tone={entry.tone} dot className={className}>
      {entry.label}
    </Badge>
  );
}

/** Explicit marker for sample/demo values. */
export function DemoBadge({ children = 'Sample data', className = '' }) {
  return (
    <Badge tone="sand" icon={FlaskConical} className={className}>
      {children}
    </Badge>
  );
}
