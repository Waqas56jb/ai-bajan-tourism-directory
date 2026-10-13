import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { categoryBySlug } from '@/data/categories';
import { getAmenityLabel } from '@/data/amenities';
import { routes } from '@/lib/routes';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { ListingBadges } from '@/components/common/Badge';
import { RatingDisplay } from '@/components/common/RatingDisplay';

/**
 * Reusable listing card. The whole card is clickable through a single stretched link on the
 * title (one tab stop, a real <a>, good screen-reader output).
 * Badges come only from data flags (isSponsored, isFeatured, isVerified, demoContent).
 */
export function BusinessCard({
  business,
  layout = 'grid',
  priority = false,
  headingLevel = 3,
  className = '',
}) {
  const category = categoryBySlug[business.category];
  const Heading = `h${headingLevel}`;
  const href = routes.business(business.slug);
  const isList = layout === 'list';

  return (
    <article
      className={`group relative flex overflow-hidden rounded-card border border-line bg-white shadow-soft transition-[box-shadow,transform,border-color] duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-lift focus-within:shadow-lift ${
        isList ? 'flex-col sm:flex-row' : 'flex-col'
      } ${className}`}
    >
      <div
        className={`img-zoom relative shrink-0 ${isList ? 'sm:min-h-[200px] sm:w-64 lg:w-72' : ''}`}
      >
        <ImageWithFallback
          imageKey={business.images?.[0]}
          alt=""
          decorative
          priority={priority}
          aspect={isList ? 'aspect-[4/3] sm:absolute sm:inset-0 sm:aspect-auto' : 'aspect-[4/3]'}
          sizes={
            isList
              ? '(min-width: 640px) 288px, 100vw'
              : '(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw'
          }
        />
        <ListingBadges business={business} className="absolute left-3 top-3 right-3" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] font-bold uppercase tracking-[0.08em] text-ocean-700">
          <span>{category?.shortName ?? business.category}</span>
          {business.businessType && (
            <>
              <span aria-hidden="true" className="text-line">
                •
              </span>
              <span className="text-muted">{business.businessType}</span>
            </>
          )}
        </p>
        <Heading className="mt-2 text-card font-extrabold leading-snug">
          <Link
            to={href}
            className="outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:after:ring-4 focus-visible:after:ring-ocean/40"
          >
            {business.name}
          </Link>
        </Heading>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-muted">
          <MapPin className="h-4 w-4 shrink-0 text-coral-600" aria-hidden="true" />
          {business.area}, {business.parish}
        </p>
        <RatingDisplay
          rating={business.rating}
          count={business.reviewCount}
          source={business.ratingSource}
          className="mt-2"
        />
        <p
          className={`mt-3 text-[0.95rem] leading-relaxed text-ink/80 ${isList ? '' : 'line-clamp-2'}`}
        >
          {business.shortDescription}
        </p>
        {isList && business.amenities?.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Amenities">
            {business.amenities.slice(0, 4).map((a) => (
              <li
                key={a}
                className="rounded-full bg-sand px-2.5 py-1 text-xs font-semibold text-navy"
              >
                {getAmenityLabel(a)}
              </li>
            ))}
          </ul>
        )}
        <span
          className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-bold text-navy transition-colors group-hover:text-ocean-700"
          aria-hidden="true"
        >
          View details
          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}
