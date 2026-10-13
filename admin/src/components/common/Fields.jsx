import { forwardRef, useId } from 'react';
import { Search, X } from 'lucide-react';

/** Label + control + helper/error wiring shared by all fields. */
export function FieldShell({
  id,
  label,
  required,
  helper,
  error,
  children,
  className = '',
  hideLabel = false,
  counter,
}) {
  return (
    <div className={className}>
      {label && (
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={id} className={hideLabel ? 'sr-only' : 'label'}>
            {label}
            {required && (
              <span className="ml-0.5 text-danger" aria-hidden="true">
                *
              </span>
            )}
            {required && <span className="sr-only"> (required)</span>}
          </label>
          {counter}
        </div>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="error-text" role="alert">
          {error}
        </p>
      ) : (
        helper && (
          <p id={`${id}-helper`} className="helper">
            {helper}
          </p>
        )
      )}
    </div>
  );
}

const describedBy = (id, error, helper) => (error ? `${id}-error` : helper ? `${id}-helper` : undefined);

export const TextField = forwardRef(function TextField(
  { label, required, helper, error, className = '', id, hideLabel, maxLength, value, prefix, ...rest },
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  const counter =
    maxLength && typeof value === 'string' ? (
      <span className={`text-2xs tabular ${value.length > maxLength * 0.9 ? 'text-warning' : 'text-muted'}`}>
        {value.length}/{maxLength}
      </span>
    ) : null;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      required={required}
      helper={helper}
      error={error}
      className={className}
      hideLabel={hideLabel}
      counter={counter}
    >
      <div className={prefix ? 'flex items-stretch' : undefined}>
        {prefix && (
          <span className="inline-flex items-center rounded-l-lg border border-r-0 border-line bg-subtle px-2.5 text-xs text-muted">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          className={`field ${prefix ? 'rounded-l-none' : ''}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-required={required || undefined}
          aria-describedby={describedBy(fieldId, error, helper)}
          maxLength={maxLength}
          value={value}
          {...rest}
        />
      </div>
    </FieldShell>
  );
});

export const TextAreaField = forwardRef(function TextAreaField(
  { label, required, helper, error, className = '', id, rows = 4, maxLength, value, ...rest },
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  const counter =
    maxLength && typeof value === 'string' ? (
      <span className={`text-2xs tabular ${value.length > maxLength * 0.9 ? 'text-warning' : 'text-muted'}`}>
        {value.length}/{maxLength}
      </span>
    ) : null;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      required={required}
      helper={helper}
      error={error}
      className={className}
      counter={counter}
    >
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        className="field resize-y"
        aria-invalid={error ? 'true' : 'false'}
        aria-required={required || undefined}
        aria-describedby={describedBy(fieldId, error, helper)}
        maxLength={maxLength}
        value={value}
        {...rest}
      />
    </FieldShell>
  );
});

/**
 * Native select. `options` = [{ value, label }] or strings. Use `onValueChange` for controlled
 * use, or spread react-hook-form's register().
 */
export const SelectField = forwardRef(function SelectField(
  {
    label,
    required,
    helper,
    error,
    className = '',
    id,
    options,
    placeholder,
    onValueChange,
    hideLabel,
    ...rest
  },
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      required={required}
      helper={helper}
      error={error}
      className={className}
      hideLabel={hideLabel}
    >
      <select
        ref={ref}
        id={fieldId}
        className="field cursor-pointer pr-8"
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy(fieldId, error, helper)}
        {...(onValueChange ? { onChange: (e) => onValueChange(e.target.value) } : {})}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const opt = typeof o === 'string' ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          );
        })}
      </select>
    </FieldShell>
  );
});

export const CheckboxField = forwardRef(function CheckboxField(
  { label, description, id, className = '', ...rest },
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      <input
        ref={ref}
        id={fieldId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line accent-[rgb(var(--accent))]"
        aria-describedby={description ? `${fieldId}-d` : undefined}
        {...rest}
      />
      <div>
        <label htmlFor={fieldId} className="cursor-pointer text-sm font-medium text-ink">
          {label}
        </label>
        {description && (
          <p id={`${fieldId}-d`} className="text-xs text-muted">
            {description}
          </p>
        )}
      </div>
    </div>
  );
});

/** Search box with clear button. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  label = 'Search',
  className = '',
  id,
  autoFocus,
  onKeyDown,
}) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={fieldId} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input
        id={fieldId}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        className="field pl-9 pr-8 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted hover:bg-subtle hover:text-ink"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
