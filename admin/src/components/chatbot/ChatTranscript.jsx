import { Link } from 'react-router-dom';
import { AlertTriangle, Lock, UserRound } from 'lucide-react';
import { LogoMark } from '@/components/layout/Logo';
import { formatTime, formatDateTime } from '@/utils/formatDate';
import { SourceReferenceList } from './SourceReferenceList';

/**
 * Renders message text as plain text with **bold** support (no HTML is ever injected).
 */
function MessageText({ text }) {
  return (
    <p className="whitespace-pre-line">
      {String(text)
        .split(/(\*\*[^*]+\*\*)/g)
        .map((part, i) =>
          part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
        )}
    </p>
  );
}

/** Transcript with user/assistant bubbles, sources, fallback markers and internal notes. */
export function ChatTranscript({ conversation, listingById }) {
  const items = [
    ...conversation.messages.map((m) => ({ kind: 'message', at: m.at, m })),
    ...(conversation.notes ?? []).map((n) => ({ kind: 'note', at: n.at, n })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));

  return (
    <ol className="space-y-5" aria-label="Transcript">
      {items.map((item) => {
        if (item.kind === 'note') {
          const n = item.n;
          return (
            <li
              key={n.id}
              className="mx-auto max-w-xl rounded-xl border border-dashed border-sand bg-sand/10 px-4 py-3 text-sm"
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold text-sand-600">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Internal note · {n.author} ·{' '}
                {formatDateTime(n.at)}
              </p>
              <p className="mt-1 text-ink">{n.text}</p>
              <p className="mt-1 text-2xs text-muted">
                Visible to admins only. Never shown to visitors or used by the chatbot.
              </p>
            </li>
          );
        }
        const m = item.m;
        if (m.role === 'user') {
          return (
            <li key={m.id} className="flex justify-end gap-2.5">
              <div className="max-w-[85%] sm:max-w-[70%]">
                <div className="rounded-2xl rounded-br-md bg-navy px-4 py-2.5 text-sm text-surface">
                  <span className="sr-only">Visitor: </span>
                  <MessageText text={m.text} />
                </div>
                <p className="mt-1 text-right text-2xs text-muted">Visitor · {formatTime(m.at)}</p>
              </div>
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-subtle text-muted"
                aria-hidden="true"
              >
                <UserRound className="h-4 w-4" />
              </span>
            </li>
          );
        }
        return (
          <li key={m.id} className="flex gap-2.5">
            <LogoMark className="h-8 w-8 shrink-0" />
            <div className="min-w-0 max-w-[90%] sm:max-w-[75%]">
              <div
                className={`rounded-2xl rounded-tl-md border px-4 py-2.5 text-sm ${m.fallback ? 'border-warning/40 bg-warning/5' : 'border-line bg-surface'}`}
              >
                <span className="sr-only">AI assistant: </span>
                {m.fallback && (
                  <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />{' '}
                    {m.error ? 'Error response' : 'Fallback response'}
                  </p>
                )}
                <MessageText text={m.text} />
              </div>
              {m.listingIds?.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2" aria-label="Related listings">
                  {m.listingIds.map((id) => {
                    const l = listingById[id];
                    if (!l) return null;
                    return (
                      <li key={id}>
                        <Link
                          to={`/listings/${id}`}
                          className="flex items-center gap-2 rounded-lg border border-line bg-surface p-1.5 pr-3 text-xs font-medium hover:border-accent/50"
                        >
                          <img
                            src={l.media.featuredImage}
                            alt=""
                            className="h-8 w-10 rounded object-cover"
                            onError={(e) => {
                              e.currentTarget.src = '/image-fallback.svg';
                            }}
                          />
                          {l.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              {m.sources?.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">
                    Sources (mock grounding)
                  </p>
                  <SourceReferenceList sources={m.sources} />
                </div>
              )}
              <p className="mt-1 text-2xs text-muted">AI Bajan · {formatTime(m.at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
