import { useId, useState } from 'react';
import { X } from 'lucide-react';

/** Add/remove short text values (tags, keywords, amenities). Enter or comma adds. */
export function TagInput({
  label,
  value = [],
  onChange,
  placeholder = 'Type and press Enter',
  helper,
  max = 20,
  suggestions = [],
}) {
  const id = useId();
  const [draft, setDraft] = useState('');

  const add = (raw) => {
    const t = raw.trim().replace(/,$/, '');
    if (!t || value.some((v) => v.toLowerCase() === t.toLowerCase()) || value.length >= max) return;
    onChange([...value, t]);
    setDraft('');
  };

  const unused = suggestions.filter((s) => !value.includes(s));

  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="field flex min-h-[2.4rem] flex-wrap items-center gap-1.5 py-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-subtle px-2 py-0.5 text-xs font-medium text-ink"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="rounded text-muted hover:text-danger"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => add(draft)}
          placeholder={value.length ? '' : placeholder}
          className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
          aria-describedby={helper ? `${id}-h` : undefined}
        />
      </div>
      {helper && (
        <p id={`${id}-h`} className="helper">
          {helper}
        </p>
      )}
      {unused.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {unused.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-md border border-dashed border-line px-2 py-0.5 text-xs text-muted hover:border-accent hover:text-accent-600"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
