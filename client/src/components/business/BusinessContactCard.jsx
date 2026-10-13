import { ExternalLink, Globe, Mail, MapPin, MessageCircle, Navigation, Phone } from 'lucide-react';
import { safeEmail, safeExternalUrl, safePhone, displayHost } from '@/lib/safeUrl';
import { areaByName } from '@/data/destinations';
import { useUI } from '@/hooks/useUI';
import { DemoNotice } from '@/components/common/DemoNotice';

function directionsUrl(business) {
  if (business.coordinates) {
    return `https://www.google.com/maps/dir/?api=1&destination=${business.coordinates.lat},${business.coordinates.lng}`;
  }
  if (business.address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${business.address}, ${business.area}, Barbados`)}`;
  }
  return null;
}

function Action({ href, icon: IconComponent, label, detail, external = true }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="group flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 transition-colors hover:border-ocean hover:bg-ocean/5"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ocean/10 text-ocean-700 group-hover:bg-ocean group-hover:text-white">
        <IconComponent className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-navy">{label}</span>
        {detail && <span className="block truncate text-sm text-muted">{detail}</span>}
      </span>
      {external && <ExternalLink className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
    </a>
  );
}

/**
 * Contact panel. Each action renders only when its underlying data exists and passes URL
 * validation. No booking or payment flows.
 */
export function BusinessContactCard({ business }) {
  const { openChat } = useUI();
  const website = safeExternalUrl(business.website);
  const email = safeEmail(business.email);
  const phone = safePhone(business.phone);
  const directions = directionsUrl(business);
  const hasAny = website || email || phone || directions;
  const area = areaByName[business.area];

  return (
    <div className="rounded-card border border-line bg-cream p-5 shadow-card sm:p-6">
      <h2 className="text-xl font-extrabold">Contact & visit</h2>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
        <MapPin className="h-4 w-4 text-coral-600" aria-hidden="true" />
        {business.address ? `${business.address}, ` : ''}
        {business.area}, {business.parish}
        {area?.coast ? ` · ${area.coast}` : ''}
      </p>

      <div className="mt-5 grid gap-2.5">
        {website && (
          <Action href={website} icon={Globe} label="Visit website" detail={displayHost(website)} />
        )}
        {phone && (
          <Action
            href={`tel:${phone}`}
            icon={Phone}
            label="Call business"
            detail={business.phone}
            external={false}
          />
        )}
        {email && (
          <Action
            href={`mailto:${email}`}
            icon={Mail}
            label="Email business"
            detail={email}
            external={false}
          />
        )}
        {directions && (
          <Action
            href={directions}
            icon={Navigation}
            label="Open directions"
            detail="Opens in Google Maps"
          />
        )}
      </div>

      {!hasAny && (
        <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-muted">
          This listing hasn’t shared contact details yet. Exact address and directions aren’t
          available.
        </p>
      )}
      {hasAny && !directions && (
        <p className="mt-3 text-sm text-muted">
          An exact address isn’t listed, so directions aren’t available.
        </p>
      )}

      <button
        type="button"
        onClick={() =>
          openChat({
            business: {
              slug: business.slug,
              name: business.name,
              category: business.category,
              area: business.area,
            },
          })
        }
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-navy px-5 py-3.5 font-bold text-white transition-colors hover:bg-navy-700"
      >
        <MessageCircle className="h-5 w-5 text-lagoon" aria-hidden="true" />
        Ask AI Bajan about this business
      </button>

      {business.demoContent && (
        <DemoNotice className="mt-4">
          Demo listing: the website, email and phone above use reserved example values and won’t
          reach a real business.
        </DemoNotice>
      )}
    </div>
  );
}
