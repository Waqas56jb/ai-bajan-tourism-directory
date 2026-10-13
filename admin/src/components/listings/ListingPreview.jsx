import { Clock, Globe, Mail, MapPin, Phone, Star } from 'lucide-react';
import { ImageWithFallback } from '@/components/common/ImageUploadPreview';
import { safeExternalUrl } from '@/utils/validation';

/**
 * Approximation of the public listing page. Shows public fields only — internal notes and
 * admin metadata are never rendered here.
 */
export function ListingPreview({ listing, categoryName, placeLabel }) {
  const website = safeExternalUrl(listing.contact.website);
  const showLocation = listing.location.displayPreference !== 'hidden';
  return (
    <article
      className="overflow-hidden rounded-2xl border border-line bg-[#fcfaf6] text-[#1d2935] shadow-card"
      aria-label="Public listing preview"
    >
      <div className="relative">
        <ImageWithFallback
          src={listing.media.featuredImage}
          alt={listing.media.featuredAlt}
          className="aspect-[21/9] w-full"
        />
        {listing.featured && (
          <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-[#123044] px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-white">
            <Star className="h-3 w-3" aria-hidden="true" /> Featured
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-8 p-6 md:grid-cols-[1fr_260px] md:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0b7671]">
            {categoryName(listing.categoryId)}
          </p>
          <h2 className="mt-1 font-serif text-3xl text-[#123044]">{listing.name}</h2>
          {showLocation && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-[#5b6973]">
              <MapPin className="h-4 w-4 text-[#e85d50]" aria-hidden="true" />
              {listing.location.displayPreference === 'exact' && listing.location.address
                ? `${listing.location.address}, `
                : ''}
              {placeLabel(listing.location)}
            </p>
          )}
          <p className="mt-5 leading-relaxed">{listing.description}</p>
          {listing.details.amenities.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {listing.details.amenities.map((a) => (
                <li
                  key={a}
                  className="rounded-full bg-[#f7f1e7] px-3 py-1 text-xs font-semibold text-[#123044]"
                >
                  {a}
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside className="space-y-4 rounded-xl bg-white p-5 ring-1 ring-[#e5e8e6]">
          <h3 className="font-bold text-[#123044]">Contact & visit</h3>
          <ul className="space-y-2 text-sm">
            {website && (
              <li className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#0b7671]" aria-hidden="true" />
                <span className="truncate">{new URL(website).host}</span>
              </li>
            )}
            {listing.contact.phone && (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#0b7671]" aria-hidden="true" />
                {listing.contact.phone}
              </li>
            )}
            {listing.contact.email && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#0b7671]" aria-hidden="true" />
                <span className="truncate">{listing.contact.email}</span>
              </li>
            )}
            {!website && !listing.contact.phone && !listing.contact.email && (
              <li className="text-[#5b6973]">No contact details shared.</li>
            )}
          </ul>
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-[#123044]">
              <Clock className="h-4 w-4" aria-hidden="true" /> Opening hours
            </h4>
            {listing.details.openingHours.length ? (
              <dl className="mt-2 space-y-1 text-sm">
                {listing.details.openingHours.map((h) => (
                  <div key={h.day} className="flex justify-between gap-3">
                    <dt>{h.day}</dt>
                    <dd className="text-[#5b6973]">{h.hours}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-1 text-sm text-[#5b6973]">Hours not provided.</p>
            )}
          </div>
        </aside>
      </div>
    </article>
  );
}
