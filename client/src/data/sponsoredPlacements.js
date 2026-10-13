/**
 * Paid / promoted placements. Every placement carries an explicit `label` that the UI renders
 * verbatim — advertising is never shown without one. Business-level flags (`isSponsored`,
 * `isFeatured`) live on the business records themselves.
 */
export const sponsoredPlacements = [
  {
    id: 'placement-banner-001',
    type: 'banner',
    label: 'Sponsored',
    businessSlug: 'turquoise-tide-catamaran',
    headline: 'Sail the west coast in style',
    body: 'Snorkel stops, gear included and private charters available. A demo sponsored banner.',
    image: 'catamaranAerial',
    cta: 'View listing',
  },
  {
    id: 'placement-destination-001',
    type: 'destination',
    label: 'Sponsored',
    destinationSlug: 'holetown',
    businessSlug: 'palm-court-boutique-hotel',
    headline: 'Stay in Holetown',
    body: 'A demo sponsored destination placement promoting a Holetown stay.',
    image: 'resortPoolPalms',
    cta: 'Explore the stay',
  },
  {
    id: 'placement-category-001',
    type: 'category',
    label: 'Featured',
    categorySlug: 'restaurants',
    headline: 'Taste the island',
    body: 'A featured category placement: dining from fish shacks to sunset terraces.',
    image: 'beachSeafoodPlate',
    cta: 'Browse dining',
  },
];
