import { Star } from 'lucide-react';
import { StatusBadge, Badge } from '@/components/common/Badge';
import { ImageWithFallback } from '@/components/common/ImageUploadPreview';
import { LISTING_STATUSES } from '@/utils/constants';

export function ListingStatusBadge({ status }) {
  return <StatusBadge status={status} map={LISTING_STATUSES} />;
}

export function FeaturedBadge() {
  return (
    <Badge tone="sand" icon={Star}>
      Featured
    </Badge>
  );
}

/** Small listing thumbnail with fallback. */
export function ListingThumb({ listing, size = 'h-10 w-14' }) {
  return (
    <ImageWithFallback src={listing?.media?.featuredImage} alt="" className={`${size} shrink-0 rounded-md`} />
  );
}
