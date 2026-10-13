export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="14" fill="#0f2a3d" />
      <circle cx="32" cy="32" r="18" fill="none" stroke="#14a6a0" strokeWidth="3.5" />
      <path d="M32 14 36.5 32 32 50 27.5 32Z" fill="#f6f1e7" />
      <path d="M32 14 36.5 32H27.5Z" fill="#e9b872" />
    </svg>
  );
}

export function Logo({ collapsed = false, descriptor = 'Platform Admin' }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <LogoMark className="h-9 w-9 shrink-0" />
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[0.95rem] font-semibold text-ink">AI Bajan</span>
          <span className="block truncate text-2xs font-medium uppercase tracking-wider text-muted">
            {descriptor}
          </span>
        </span>
      )}
    </span>
  );
}
