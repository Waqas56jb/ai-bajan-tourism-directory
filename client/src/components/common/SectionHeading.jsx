import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  tone = 'dark',
  action,
  as: Tag = 'h2',
  id,
  className = '',
}) {
  const center = align === 'center';
  const light = tone === 'light';
  return (
    <div
      className={`mb-10 flex flex-col gap-6 md:mb-14 ${center ? 'items-center text-center' : 'md:flex-row md:items-end md:justify-between'} ${className}`}
    >
      <div className={center ? 'max-w-3xl' : 'max-w-2xl'}>
        {eyebrow && <p className={`eyebrow mb-4 ${light ? 'eyebrow-light' : ''}`}>{eyebrow}</p>}
        <Tag
          id={id}
          className={`text-section font-display font-normal text-balance ${light ? 'text-white' : 'text-navy'}`}
        >
          {title}
        </Tag>
        {description && (
          <p className={`mt-4 text-lead text-pretty ${light ? 'text-white/80' : 'text-muted'}`}>
            {description}
          </p>
        )}
      </div>
      {action && (
        <Link
          to={action.to}
          className={`group inline-flex shrink-0 items-center gap-2 rounded-full font-bold ${light ? 'text-white' : 'text-navy'} hover:text-ocean-700`}
        >
          {action.label}
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      )}
    </div>
  );
}
