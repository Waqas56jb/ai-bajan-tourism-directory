import { lazy, Suspense } from 'react';
import { Check, Clock } from 'lucide-react';
import { amenities as amenityVocabulary } from '@/data/amenities';
import { areaByName } from '@/data/destinations';
import { Icon } from '@/components/common/Icon';
import { LoadingSpinner } from '@/components/common/States';

const BusinessMap = lazy(() => import('@/components/directory/BusinessMap'));

export function BusinessOpeningHours({ hours, demo }) {
  if (!hours?.length) return null;
  return (
    <section
      aria-labelledby="hours-heading"
      className="rounded-card border border-line bg-white p-6"
    >
      <h2 id="hours-heading" className="flex items-center gap-2 text-xl font-extrabold">
        <Clock className="h-5 w-5 text-ocean-700" aria-hidden="true" />
        Opening hours
      </h2>
      <dl className="mt-4 divide-y divide-line">
        {hours.map((h) => (
          <div key={h.days} className="flex justify-between gap-4 py-2.5 text-[0.95rem]">
            <dt className="font-semibold text-navy">{h.days}</dt>
            <dd className={h.hours === 'Closed' ? 'text-muted' : 'text-ink'}>{h.hours}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-muted">
        {demo
          ? 'Sample hours for a demo listing.'
          : 'Hours supplied by the business. Please confirm before visiting.'}
      </p>
    </section>
  );
}

export function BusinessAmenities({ items }) {
  if (!items?.length) return null;
  return (
    <section aria-labelledby="amenities-heading">
      <h2 id="amenities-heading" className="text-xl font-extrabold">
        Amenities & services
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((a) => (
          <li
            key={a}
            className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-line"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-sand text-ocean-700">
              <Icon name={amenityVocabulary[a]?.icon} className="h-[18px] w-[18px]" />
            </span>
            <span className="font-semibold text-navy">{amenityVocabulary[a]?.label ?? a}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BusinessHighlights({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-6 grid gap-2 sm:grid-cols-3">
      {items.map((h) => (
        <li
          key={h}
          className="flex items-start gap-2 rounded-2xl bg-sand/70 px-4 py-3 text-[0.95rem] font-semibold text-navy"
        >
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-palm" aria-hidden="true" />
          {h}
        </li>
      ))}
    </ul>
  );
}

/**
 * Location section. Uses exact coordinates when the listing has them; otherwise shows an
 * area-level map clearly labelled as approximate. Never invents coordinates.
 */
export function BusinessLocationMap({ business }) {
  const area = areaByName[business.area];
  if (!business.coordinates && !area) return null;
  return (
    <section aria-labelledby="location-heading">
      <h2 id="location-heading" className="text-xl font-extrabold">
        Location
      </h2>
      <p className="mt-2 text-muted">
        {business.coordinates
          ? `${business.name} is in ${business.area}, ${business.parish}.`
          : `${business.name} is listed in ${business.area}, ${business.parish}${area?.coast ? ` on the ${area.coast.toLowerCase()}` : ''}. The map shows the general area — an exact location hasn’t been provided.`}
      </p>
      <Suspense
        fallback={
          <LoadingSpinner label="Loading map…" className="mt-4 h-72 rounded-card bg-sand" />
        }
      >
        <BusinessMap
          businesses={[business]}
          single
          className="mt-4 h-72 md:h-80"
          zoom={business.coordinates ? 15 : 13}
        />
      </Suspense>
    </section>
  );
}
