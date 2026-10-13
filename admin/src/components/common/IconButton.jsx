import { forwardRef } from 'react';
import { Tooltip } from './Tooltip';

/** Icon-only button. `label` is required: it is both the accessible name and the tooltip. */
export const IconButton = forwardRef(function IconButton(
  {
    label,
    icon: Icon,
    size = 'md',
    variant = 'ghost',
    className = '',
    tooltip = true,
    type = 'button',
    ...rest
  },
  ref,
) {
  const sizes = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-10 w-10' };
  const variants = {
    ghost: 'text-muted hover:bg-subtle hover:text-ink',
    outline: 'border border-line bg-surface text-ink hover:bg-subtle',
    danger: 'text-muted hover:bg-danger/10 hover:text-danger',
  };
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'} aria-hidden="true" />
    </button>
  );
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
});
