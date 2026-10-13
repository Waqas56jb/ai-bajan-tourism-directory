import { Link } from 'react-router-dom';
import { BookOpen, FileText, Store } from 'lucide-react';
import { classifyHref } from '@/lib/safeUrl';

const icons = { listing: Store, guide: BookOpen, page: FileText };

/** Source references supplied with an answer. Links are validated before rendering. */
export function ChatSourceReference({ sources, onNavigate }) {
  const valid = (sources ?? [])
    .map((s) => ({ ...s, target: classifyHref(s?.url) }))
    .filter((s) => s.target && typeof s.title === 'string');
  if (!valid.length) return null;
  return (
    <div className="mt-2.5">
      <p className="mb-1 text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-muted">
        Sources
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {valid.map((s) => {
          const IconComponent = icons[s.type] ?? FileText;
          const cls =
            'inline-flex max-w-full items-center gap-1.5 rounded-lg bg-sand px-2.5 py-1 text-xs font-semibold text-navy hover:bg-ocean/10 hover:text-ocean-700';
          const content = (
            <>
              <IconComponent className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{s.title}</span>
            </>
          );
          return (
            <li key={`${s.type}-${s.target.href}`} className="max-w-full">
              {s.target.kind === 'internal' ? (
                <Link to={s.target.href} onClick={onNavigate} className={cls}>
                  {content}
                </Link>
              ) : (
                <a
                  href={s.target.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className={cls}
                >
                  {content}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
