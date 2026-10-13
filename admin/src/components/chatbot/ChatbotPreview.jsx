import { BookOpen, Compass, MessageCircle, Sparkles, Store } from 'lucide-react';

const AVATARS = { compass: Compass, sparkles: Sparkles, chat: MessageCircle };

/**
 * Visual preview of the public chat widget. Purely presentational — no AI API is called.
 * messages: [{ role: 'user'|'assistant', text, sources?: [{ type, title }] }]
 */
export function ChatbotPreview({ settings, messages = [], className = '', compact = false }) {
  const color = /^#[0-9a-f]{6}$/i.test(settings?.brandColor ?? '') ? settings.brandColor : '#0d948e';
  const Avatar = AVATARS[settings?.avatar] ?? Compass;
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-line bg-white text-[#1d2935] shadow-pop ${className}`}
      aria-label="Chat widget preview"
      role="img"
    >
      <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ backgroundColor: '#0f2a3d' }}>
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ backgroundColor: color }}>
          <Avatar className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {settings?.widgetTitle || settings?.displayName || 'AI Bajan'}
          </p>
          <p className="truncate text-xs text-white/70">{settings?.widgetSubtitle || 'Travel assistant'}</p>
        </div>
      </div>
      <div className={`space-y-3 bg-[#fcfaf6] px-4 py-4 ${compact ? '' : 'min-h-[220px]'}`}>
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <p
              key={i}
              className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#123044] px-3 py-2 text-sm text-white"
            >
              {m.text}
            </p>
          ) : (
            <div key={i} className="flex gap-2">
              <span
                className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white"
                style={{ backgroundColor: color }}
              >
                <Avatar className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 max-w-[85%]">
                <p className="whitespace-pre-line rounded-2xl rounded-tl-md bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-[#e5e8e6]">
                  {m.text || <span className="italic text-[#64727c]">No answer text yet.</span>}
                </p>
                {m.sources?.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-1">
                    {m.sources.map((s) => (
                      <li
                        key={s.title}
                        className="inline-flex items-center gap-1 rounded-md bg-[#f7f1e7] px-2 py-0.5 text-[0.7rem] font-medium text-[#123044]"
                      >
                        {s.type === 'listing' ? (
                          <Store className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <BookOpen className="h-3 w-3" aria-hidden="true" />
                        )}
                        {s.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ),
        )}
      </div>
      <div className="border-t border-[#e5e8e6] bg-white px-4 py-3">
        <div className="rounded-full bg-[#f2f4f3] px-4 py-2 text-xs text-[#64727c]">
          Ask about places, food, stays…
        </div>
      </div>
    </div>
  );
}
