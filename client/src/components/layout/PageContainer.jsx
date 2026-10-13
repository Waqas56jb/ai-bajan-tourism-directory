import { motion } from 'framer-motion';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Breadcrumbs } from './Breadcrumbs';

export function PageContainer({ children, className = '' }) {
  return <div className={`container-page ${className}`}>{children}</div>;
}

/**
 * Full-bleed image hero for overlay pages (header sits on top of it).
 * Height adapts: shorter on phones, taller on desktop.
 */
export function PageHero({
  imageKey,
  eyebrow,
  title,
  description,
  breadcrumbs,
  children,
  size = 'md',
  align = 'left',
  badge,
}) {
  const heights = {
    sm: 'min-h-[420px] md:min-h-[460px]',
    md: 'min-h-[520px] md:min-h-[600px]',
    lg: 'min-h-[600px] md:min-h-[720px]',
  };
  return (
    <section
      className={`relative isolate flex items-end overflow-hidden bg-navy-900 ${heights[size]}`}
    >
      <ImageWithFallback
        imageKey={imageKey}
        priority
        sizes="100vw"
        className="absolute inset-0 -z-10 !bg-navy-900"
      />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-900/90 via-navy-900/45 to-navy-900/30"
        aria-hidden="true"
      />
      <div
        className="container-page pb-12 md:pb-16"
        style={{ paddingTop: 'calc(var(--chrome-h, 108px) + 2.5rem)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}
        >
          {breadcrumbs && <Breadcrumbs items={breadcrumbs} tone="light" className="mb-6" />}
          {badge}
          {eyebrow && <p className="eyebrow eyebrow-light mb-4">{eyebrow}</p>}
          <h1 className="text-page font-display font-normal text-balance text-white">{title}</h1>
          {description && (
            <p className="mt-5 max-w-2xl text-lead text-white/85 text-pretty">{description}</p>
          )}
          {children && <div className="mt-8">{children}</div>}
        </motion.div>
      </div>
    </section>
  );
}

/** Plain page header for non-overlay pages (directory, legal, contact…). */
export function PageHeader({ eyebrow, title, description, breadcrumbs, children, className = '' }) {
  return (
    <header className={`container-page pb-8 pt-8 md:pb-12 md:pt-12 ${className}`}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-6" />}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {eyebrow && <p className="eyebrow mb-4">{eyebrow}</p>}
        <h1 className="max-w-4xl text-page font-display font-normal text-balance">{title}</h1>
        {description && (
          <p className="mt-4 max-w-2xl text-lead text-muted text-pretty">{description}</p>
        )}
        {children}
      </motion.div>
    </header>
  );
}
