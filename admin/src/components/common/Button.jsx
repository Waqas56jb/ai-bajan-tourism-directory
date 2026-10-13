import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-navy text-surface hover:bg-navy-600 shadow-sm',
  accent: 'bg-accent text-white hover:bg-accent-600 shadow-sm',
  secondary: 'bg-subtle text-ink hover:bg-line/70',
  outline: 'border border-line bg-surface text-ink hover:bg-subtle hover:border-muted/40',
  ghost: 'text-ink hover:bg-subtle',
  destructive: 'bg-danger text-white hover:bg-danger/90 shadow-sm',
  'destructive-outline': 'border border-danger/40 bg-surface text-danger hover:bg-danger/5',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
};

/**
 * Primary button. Renders a router <Link> when `to` is provided.
 * `loading` disables the button and shows a spinner (with aria-busy).
 */
export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    to,
    loading = false,
    icon: Icon,
    iconRight: IconRight,
    className = '',
    children,
    type = 'button',
    disabled,
    ...rest
  },
  ref,
) {
  const classes = `inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  const content = (
    <>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon className="h-4 w-4" aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight className="h-4 w-4" aria-hidden="true" />}
    </>
  );
  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
});
