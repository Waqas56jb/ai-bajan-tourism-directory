const PALETTE = ['#0d948e', '#0f2a3d', '#b07d36', '#2563c7', '#7c5cbf', '#c4302b', '#168048'];

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase() || '?';
}

function colorFor(name = '') {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Initials avatar (no remote images of people). Decorative unless `label` is given. */
export function Avatar({ name, size = 'md', color, className = '', label }) {
  const sizes = {
    xs: 'h-6 w-6 text-[0.6rem]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-xs',
    lg: 'h-14 w-14 text-base',
    xl: 'h-20 w-20 text-xl',
  };
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ${sizes[size]} ${className}`}
      style={{ backgroundColor: color ?? colorFor(name) }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    >
      {initials(name)}
    </span>
  );
}
