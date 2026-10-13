import { useId } from 'react';
import { toInputDate } from '@/utils/formatDate';

const PRESETS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

/**
 * From/to date inputs with quick presets. Values are yyyy-mm-dd strings ('' = open-ended).
 * Prevents an end date earlier than the start date.
 */
export function DateRangePicker({ from, to, onChange, label = 'Date range', className = '' }) {
  const id = useId();
  const applyPreset = (days) => {
    if (!days) return onChange('', '');
    const end = new Date();
    const start = new Date(Date.now() - (Number(days) - 1) * 86_400_000);
    onChange(toInputDate(start), toInputDate(end));
  };
  return (
    <fieldset className={className}>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${id}-preset`} className="sr-only">
          Preset range
        </label>
        <select
          id={`${id}-preset`}
          className="field w-auto pr-8"
          value=""
          onChange={(e) => applyPreset(e.target.value)}
        >
          <option value="">Preset…</option>
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
          <option value="0">Any time</option>
        </select>
        <label htmlFor={`${id}-from`} className="sr-only">
          From
        </label>
        <input
          id={`${id}-from`}
          type="date"
          className="field w-auto"
          value={from}
          max={to || undefined}
          onChange={(e) => onChange(e.target.value, to)}
        />
        <span className="text-xs text-muted" aria-hidden="true">
          to
        </span>
        <label htmlFor={`${id}-to`} className="sr-only">
          To
        </label>
        <input
          id={`${id}-to`}
          type="date"
          className="field w-auto"
          value={to}
          min={from || undefined}
          onChange={(e) => onChange(from, e.target.value)}
        />
      </div>
    </fieldset>
  );
}
