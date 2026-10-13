import { Link } from 'react-router-dom';

/** Compass-and-wave mark used everywhere the brand appears. */
export function LogoMark({ className = 'h-9 w-9', tone = 'dark' }) {
  const bg = tone === 'dark' ? '#123044' : '#FFFFFF';
  const needle = tone === 'dark' ? '#FCFAF6' : '#123044';
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" fill={bg} />
      <circle cx="32" cy="32" r="19" fill="none" stroke="#40C9C1" strokeWidth="3" />
      <path d="M32 13 L36.5 32 L32 51 L27.5 32 Z" fill={needle} />
      <path d="M32 13 L36.5 32 L27.5 32 Z" fill="#FF786B" />
      <path
        d="M14 40c4.5-3 9-3 13.5 0s9 3 13.5 0 9-3 9 0"
        fill="none"
        stroke="#40C9C1"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ tone = 'dark', className = '', asLink = true, onClick }) {
  const text = tone === 'dark' ? 'text-navy' : 'text-white';
  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark tone={tone} />
      <span className={`text-[1.3rem] font-extrabold tracking-tight ${text}`}>
        AI <span className="font-display font-normal italic text-ocean">Bajan</span>
      </span>
    </span>
  );
  if (!asLink) return inner;
  return (
    <Link to="/" aria-label="AI Bajan home" className="rounded-lg" onClick={onClick}>
      {inner}
    </Link>
  );
}
