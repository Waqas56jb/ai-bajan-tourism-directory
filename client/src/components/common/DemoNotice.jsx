import { FlaskConical } from 'lucide-react';

/** Honest, visible labelling of demo-only behaviour. */
export function DemoNotice({ children, className = '', tone = 'light' }) {
  const styles =
    tone === 'dark'
      ? 'bg-white/10 text-white/90 ring-1 ring-white/20'
      : 'bg-sand text-navy ring-1 ring-navy/10';
  return (
    <p
      className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm leading-relaxed ${styles} ${className}`}
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-ocean-700" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
