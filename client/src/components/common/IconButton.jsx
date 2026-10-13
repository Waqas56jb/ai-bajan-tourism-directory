import { forwardRef } from 'react';

/** Icon-only button. `label` is required and becomes the accessible name. */
export const IconButton = forwardRef(function IconButton(
  { label, icon: IconComponent, className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`icon-btn ${className}`}
      {...rest}
    >
      <IconComponent className="h-5 w-5" aria-hidden="true" />
    </button>
  );
});
