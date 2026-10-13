const DAY = 86_400_000;

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value, opts = {}) {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...opts });
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  return `${formatDate(d)}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatTime(value) {
  const d = toDate(value);
  return d ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
}

/** "3 mins ago", "yesterday", "12 Mar 2026" */
export function formatRelative(value, now = Date.now()) {
  const d = toDate(value);
  if (!d) return '—';
  const diff = now - d.getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const fmt = (n, unit) => {
    const label = `${n} ${unit}${n === 1 ? '' : 's'}`;
    return future ? `in ${label}` : `${label} ago`;
  };
  if (abs < 60_000) return future ? 'in a moment' : 'just now';
  if (abs < 3_600_000) return fmt(Math.round(abs / 60_000), 'min');
  if (abs < DAY) return fmt(Math.round(abs / 3_600_000), 'hour');
  if (abs < 2 * DAY) return future ? 'tomorrow' : 'yesterday';
  if (abs < 7 * DAY) return fmt(Math.round(abs / DAY), 'day');
  return formatDate(d);
}

/** yyyy-mm-dd for <input type="date"> */
export function toInputDate(value) {
  const d = toDate(value);
  if (!d) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysBetween(a, b) {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return null;
  return Math.round((db.getTime() - da.getTime()) / DAY);
}

/** Is `value` inside an inclusive yyyy-mm-dd range (either bound optional)? */
export function inDateRange(value, from, to) {
  if (!from && !to) return true;
  const d = toDate(value);
  if (!d) return false;
  if (from && d < new Date(`${from}T00:00:00`)) return false;
  if (to && d > new Date(`${to}T23:59:59`)) return false;
  return true;
}
