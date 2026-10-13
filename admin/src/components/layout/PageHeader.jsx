import { usePageTitle } from '@/context/PageMetaContext';

/** Page title + description + actions. Also sets the document title. */
export function PageHeader({ title, description, actions, badge, children, setTitle = true }) {
  usePageTitle(setTitle ? (typeof title === 'string' ? title : null) : null);
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 break-words text-xl font-semibold tracking-tight sm:text-[1.4rem]">
            {title}
          </h1>
          {badge}
        </div>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
