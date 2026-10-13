import { useId } from 'react';

/** Accessible switch (role="switch"). Controlled via `checked` + `onChange(nextBool)`. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
  className = '',
  size = 'md',
}) {
  const auto = useId();
  const fieldId = id ?? auto;
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const knob = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const shift = size === 'sm' ? 'translate-x-4' : 'translate-x-5';
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      {(label || description) && (
        <div className="min-w-0">
          {label && (
            <label htmlFor={fieldId} className="block cursor-pointer text-sm font-medium text-ink">
              {label}
            </label>
          )}
          {description && (
            <p id={`${fieldId}-d`} className="mt-0.5 text-xs text-muted">
              {description}
            </p>
          )}
        </div>
      )}
      <button
        id={fieldId}
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        aria-describedby={description ? `${fieldId}-d` : undefined}
        aria-label={label ? undefined : 'Toggle'}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 ${track} ${checked ? 'bg-accent' : 'bg-line'}`}
      >
        <span
          className={`inline-block transform rounded-full bg-white shadow transition-transform ${knob} ${checked ? shift : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
}
