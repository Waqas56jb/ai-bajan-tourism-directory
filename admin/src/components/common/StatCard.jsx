import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatNumber, formatPercent } from '@/utils/formatNumber';

/**
 * KPI card. `change` is a fraction (0.12 = +12%) or null when no comparison exists.
 * `positiveIsGood=false` flips colouring (e.g. for error counts).
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  change = null,
  changeLabel = 'vs previous period',
  hint,
  to,
  tone = 'accent',
  positiveIsGood = true,
  format = formatNumber,
  sample = false,
}) {
  const up = change !== null && change > 0;
  const flat = change !== null && Math.abs(change) < 0.005;
  const good = flat ? null : positiveIsGood ? up : !up;
  const TrendIcon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const tones = {
    accent: 'bg-accent/10 text-accent-600',
    navy: 'bg-navy/10 text-navy',
    sand: 'bg-sand/20 text-sand-600',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
    info: 'bg-info/10 text-info',
    success: 'bg-success/10 text-success',
  };

  const description = `${label}: ${typeof value === 'number' ? format(value) : value}${change !== null ? `, ${up ? 'up' : 'down'} ${formatPercent(Math.abs(change))} ${changeLabel}` : ''}${sample ? ' (sample data)' : ''}`;

  const body = (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className={`card h-full p-4 transition-shadow ${to ? 'hover:shadow-pop' : ''}`}
    >
      <span className="sr-only">{description}</span>
      <div aria-hidden="true">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-muted">{label}</p>
          {Icon && (
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>
              <Icon className="h-4 w-4" />
            </span>
          )}
        </div>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink tabular">
          {typeof value === 'number' ? format(value) : value}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {change !== null && (
            <span
              className={`inline-flex items-center gap-0.5 font-medium ${good === null ? 'text-muted' : good ? 'text-success' : 'text-danger'}`}
            >
              <TrendIcon className="h-3.5 w-3.5" />
              {formatPercent(Math.abs(change), 1)}
            </span>
          )}
          <span className="text-muted">{change !== null ? changeLabel : hint}</span>
          {sample && (
            <span className="rounded bg-sand/20 px-1 text-2xs font-medium text-sand-600">Sample</span>
          )}
        </div>
      </div>
    </motion.div>
  );

  return to ? (
    <Link
      to={to}
      className="block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {body}
    </Link>
  ) : (
    body
  );
}
