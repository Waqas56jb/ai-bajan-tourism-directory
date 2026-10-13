import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { getReadingTime } from '@/data/travelGuides';
import { routes } from '@/lib/routes';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

/** Editorial guide card. Author / date only render when supplied. */
export function GuideCard({ guide, variant = 'default', headingLevel = 3, priority = false }) {
  const Heading = `h${headingLevel}`;
  const minutes = getReadingTime(guide);
  const large = variant === 'feature';

  return (
    <article
      className={`group relative flex h-full flex-col ${large ? 'lg:flex-row lg:items-stretch lg:gap-10' : ''}`}
    >
      <div className={`img-zoom overflow-hidden rounded-card ${large ? 'lg:w-[58%]' : ''}`}>
        <ImageWithFallback
          imageKey={guide.image}
          decorative
          priority={priority}
          aspect={large ? 'aspect-[16/10] lg:aspect-auto lg:h-full' : 'aspect-[4/3]'}
          sizes={
            large
              ? '(min-width: 1024px) 58vw, 100vw'
              : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
          }
          className={large ? 'lg:h-full' : ''}
        />
      </div>
      <div className={`flex flex-1 flex-col ${large ? 'pt-6 lg:justify-center lg:py-6' : 'pt-5'}`}>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold">
          <span className="text-ocean-700">{guide.category}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-muted">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {minutes} min read
          </span>
          {guide.author && <span className="font-semibold text-muted">By {guide.author}</span>}
        </p>
        <Heading
          className={`mt-2 font-display font-normal leading-tight ${large ? 'text-3xl md:text-[2.6rem]' : 'text-2xl'}`}
        >
          <Link
            to={routes.guide(guide.slug)}
            className="outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:after:ring-4 focus-visible:after:ring-ocean/40 group-hover:text-ocean-700"
          >
            {guide.title}
          </Link>
        </Heading>
        <p className={`mt-3 text-muted ${large ? 'text-lead' : 'line-clamp-3'}`}>{guide.excerpt}</p>
        <span
          className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-bold text-navy"
          aria-hidden="true"
        >
          Read guide{' '}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}
