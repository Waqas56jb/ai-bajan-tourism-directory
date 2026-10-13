export function Card({ as: Tag = 'section', className = '', children, padded = true, ...rest }) {
  return (
    <Tag className={`card ${padded ? 'p-5' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/** Header row inside a card: title, optional description and right-side actions. */
export function CardHeader({ title, description, actions, id, className = '', badge }) {
  return (
    <div className={`mb-4 flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 id={id} className="flex items-center gap-2 text-[0.95rem] font-semibold">
          {title}
          {badge}
        </h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
