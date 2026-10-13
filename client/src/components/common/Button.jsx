import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'btn-primary',
  accent: 'btn-accent',
  coral: 'btn-coral',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  light: 'btn-light',
  glass: 'btn-glass',
};
const sizes = { sm: 'btn-sm', md: '', lg: 'btn-lg' };

/**
 * One button for every case: renders a router <Link> when `to` is set, an external <a> when
 * `href` is set, otherwise a <button>.
 */
export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    to,
    href,
    loading = false,
    iconLeft,
    iconRight,
    className = '',
    children,
    type,
    disabled,
    ...rest
  },
  ref,
) {
  const classes = `btn ${variants[variant]} ${sizes[size]} ${className}`.trim();
  const content = (
    <>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : iconLeft}
      <span>{children}</span>
      {!loading && iconRight}
    </>
  );

  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a
        ref={ref}
        href={href}
        className={classes}
        target="_blank"
        rel="noopener noreferrer"
        {...rest}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
});
