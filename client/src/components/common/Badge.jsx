import { BadgeCheck, FlaskConical, Megaphone, Star } from 'lucide-react';

const styles = {
  sponsored: 'bg-coral text-navy-900',
  featured: 'bg-navy text-white',
  verified: 'bg-palm text-white',
  demo: 'bg-white/95 text-navy ring-1 ring-navy/15',
  neutral: 'bg-sand text-navy',
  ocean: 'bg-ocean/10 text-ocean-700',
  glass: 'bg-white/15 text-white ring-1 ring-white/40 backdrop-blur',
};

const icons = { sponsored: Megaphone, featured: Star, verified: BadgeCheck, demo: FlaskConical };

/** Small label. Icons accompany colour so status never relies on colour alone. */
export function Badge({ variant = 'neutral', children, className = '', icon = true }) {
  const IconComponent = icon ? icons[variant] : null;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.72rem] font-extrabold uppercase tracking-[0.06em] ${styles[variant]} ${className}`}
    >
      {IconComponent && <IconComponent className="h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** The standard set of status badges for a listing, driven entirely by data flags. */
export function ListingBadges({ business, className = '', showDemo = true }) {
  if (!business) return null;
  const items = [];
  if (business.isSponsored)
    items.push(
      <Badge key="s" variant="sponsored">
        Sponsored
      </Badge>,
    );
  if (business.isFeatured)
    items.push(
      <Badge key="f" variant="featured">
        Featured
      </Badge>,
    );
  if (business.isVerified)
    items.push(
      <Badge key="v" variant="verified">
        Verified
      </Badge>,
    );
  if (showDemo && business.demoContent)
    items.push(
      <Badge key="d" variant="demo">
        Demo
      </Badge>,
    );
  if (!items.length) return null;
  return <div className={`flex flex-wrap gap-1.5 ${className}`}>{items}</div>;
}
