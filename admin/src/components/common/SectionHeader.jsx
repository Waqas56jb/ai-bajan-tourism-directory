/** Heading for a group of form fields or a page sub-section. */
export function SectionHeader({ title, description, id, actions, className = '', step }) {
  return (
    <div className={`mb-4 flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="flex items-start gap-3">
        {step && (
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/10 text-xs font-semibold text-accent-600">
            {step}
          </span>
        )}
        <div>
          <h2 id={id} className="text-[0.95rem] font-semibold">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}
