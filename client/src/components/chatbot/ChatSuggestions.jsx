import { Sparkles } from 'lucide-react';

const DEFAULT_SUGGESTIONS = [
  'Find restaurants near Holetown.',
  'Show guesthouses in Christ Church.',
  'Find snorkeling tours.',
  'Explore local shops in Bridgetown.',
  'What tourism information is available?',
];

export function ChatSuggestions({
  suggestions = DEFAULT_SUGGESTIONS,
  onSelect,
  disabled,
  title = 'Try asking',
}) {
  return (
    <div className="mt-1">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-muted">
        <Sparkles className="h-3.5 w-3.5 text-coral-600" aria-hidden="true" />
        {title}
      </p>
      <ul className="grid gap-2">
        {suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(s)}
              className="w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-left text-sm font-semibold text-navy transition-colors hover:border-ocean hover:bg-ocean/5 disabled:opacity-50"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
