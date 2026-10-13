import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin, RotateCcw, TriangleAlert } from 'lucide-react';
import { routes } from '@/lib/routes';
import { SafeMarkdown } from '@/components/common/SafeMarkdown';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { LogoMark } from '@/components/common/Logo';
import { ChatSourceReference } from './ChatSourceReference';

/** Compact, clickable business result inside a chat reply. Renders only returned fields. */
export function ChatBusinessCard({ business, onNavigate }) {
  if (!business?.slug || !business?.name) return null;
  return (
    <li className="min-w-0">
      <Link
        to={routes.business(business.slug)}
        onClick={onNavigate}
        className="group flex gap-3 rounded-2xl border border-line bg-white p-2.5 transition-colors hover:border-ocean"
      >
        <ImageWithFallback
          imageKey={business.image}
          decorative
          className="h-16 w-16 shrink-0 rounded-xl"
          sizes="64px"
        />
        <span className="min-w-0 flex-1 py-0.5">
          <span className="flex flex-wrap items-center gap-1.5">
            {business.categoryName && (
              <span className="rounded-full bg-ocean/10 px-2 py-0.5 text-[0.68rem] font-extrabold uppercase tracking-wide text-ocean-700">
                {business.categoryName}
              </span>
            )}
            {business.isSponsored && (
              <span className="rounded-full bg-coral px-2 py-0.5 text-[0.68rem] font-extrabold uppercase tracking-wide text-navy-900">
                Sponsored
              </span>
            )}
            {business.demoContent && (
              <span className="rounded-full bg-sand px-2 py-0.5 text-[0.68rem] font-extrabold uppercase tracking-wide text-navy">
                Demo
              </span>
            )}
          </span>
          <span className="mt-1 flex items-center gap-1 font-bold leading-tight text-navy">
            <span className="truncate">{business.name}</span>
            <ArrowUpRight
              className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden="true"
            />
          </span>
          {business.area && (
            <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-muted">
              <MapPin className="h-3 w-3 text-coral-600" aria-hidden="true" />
              {business.area}
              {business.parish ? `, ${business.parish}` : ''}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

export function ChatMessage({ message, onRetry, onFollowUp, onNavigate, disabled }) {
  if (message.role === 'user') {
    return (
      <li className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl rounded-br-lg bg-navy px-4 py-2.5 text-[0.95rem] text-white">
          <span className="sr-only">You said: </span>
          {message.content}
        </p>
      </li>
    );
  }

  if (message.status === 'error') {
    return (
      <li className="flex gap-2.5">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-coral/15 text-coral-600">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
        </span>
        <div
          role="alert"
          className="max-w-[85%] rounded-3xl rounded-tl-lg border border-coral/40 bg-coral/10 px-4 py-3 text-[0.95rem] text-ink"
        >
          <p className="font-bold text-navy">Message not answered</p>
          <p className="mt-0.5">{message.content}</p>
          {message.retryable && (
            <button
              type="button"
              onClick={() => onRetry(message.id)}
              disabled={disabled}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-navy ring-1 ring-navy/15 hover:ring-navy disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <li className="flex gap-2.5">
      <LogoMark className="mt-0.5 h-8 w-8 shrink-0" />
      <div className="min-w-0 max-w-[88%] flex-1">
        <div className="rounded-3xl rounded-tl-lg bg-white px-4 py-3 text-[0.95rem] leading-relaxed text-ink shadow-soft ring-1 ring-line/70">
          <span className="sr-only">AI Bajan said: </span>
          <SafeMarkdown className="chat-md">{message.content}</SafeMarkdown>
        </div>
        {message.businesses?.length > 0 && (
          <ul
            className="mt-2.5 grid grid-cols-[minmax(0,1fr)] gap-2"
            aria-label="Directory results"
          >
            {message.businesses.map((b) => (
              <ChatBusinessCard key={b.id ?? b.slug} business={b} onNavigate={onNavigate} />
            ))}
          </ul>
        )}
        <ChatSourceReference sources={message.sources} onNavigate={onNavigate} />
        {message.followUps?.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Suggested follow-up questions">
            {message.followUps.map((f) => (
              <li key={f}>
                <button
                  type="button"
                  onClick={() => onFollowUp(f)}
                  disabled={disabled}
                  className="rounded-full border border-ocean/40 bg-white px-3 py-1.5 text-left text-[0.82rem] font-semibold text-ocean-700 transition-colors hover:bg-ocean hover:text-white disabled:opacity-50"
                >
                  {f}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
