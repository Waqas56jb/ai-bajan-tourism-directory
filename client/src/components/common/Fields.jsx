import { forwardRef, useId } from 'react';
import { Search, X } from 'lucide-react';

/** Search box with a clear button. Controlled. */
export const SearchInput = forwardRef(function SearchInput(
  {
    value,
    onChange,
    onClear,
    label = 'Search',
    placeholder = 'Search…',
    className = '',
    inputClassName = '',
    id,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input
        ref={ref}
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        className={`field-input pl-12 pr-12 [&::-webkit-search-cancel-button]:appearance-none ${inputClassName}`}
        {...rest}
      />
      {value && (
        <button
          type="button"
          onClick={() => (onClear ? onClear() : onChange(''))}
          className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-sand hover:text-navy"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
});

/**
 * Labelled native select (best mobile UX + accessibility for simple choices).
 * Use `onValueChange(value)` for controlled use, or spread react-hook-form's `register()`.
 */
export const SelectField = forwardRef(function SelectField(
  {
    label,
    options,
    onValueChange,
    placeholder,
    className = '',
    hideLabel = false,
    id,
    error,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={selectId} className={hideLabel ? 'sr-only' : 'field-label'}>
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        {...(onValueChange ? { onChange: (e) => onValueChange(e.target.value) } : {})}
        className="field-input cursor-pointer"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${selectId}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
});

/** Text input / textarea with label + inline error, for react-hook-form `register`. */
export const TextField = forwardRef(function TextField(
  { label, error, multiline = false, hint, id, className = '', ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedBy =
    [hint && `${fieldId}-hint`, error && `${fieldId}-error`].filter(Boolean).join(' ') || undefined;
  const Component = multiline ? 'textarea' : 'input';
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="field-label">
        {label}
      </label>
      {hint && (
        <p id={`${fieldId}-hint`} className="-mt-1 mb-2 text-sm text-muted">
          {hint}
        </p>
      )}
      <Component
        ref={ref}
        id={fieldId}
        className="field-input"
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy}
        {...rest}
      />
      {error && (
        <p id={`${fieldId}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
