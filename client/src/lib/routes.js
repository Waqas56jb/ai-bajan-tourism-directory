/** Route builders — the single source of truth for public URLs. */
export const routes = {
  home: () => '/',
  businesses: (params) => {
    const qs = params ? new URLSearchParams(cleanParams(params)).toString() : '';
    return qs ? `/businesses?${qs}` : '/businesses';
  },
  business: (slug) => `/business/${slug}`,
  category: (slug) => `/category/${slug}`,
  destination: (slug) => `/places/${slug}`,
  discover: () => '/discover',
  guides: () => '/guides',
  guide: (slug) => `/guides/${slug}`,
  about: () => '/about',
  contact: (topic) => (topic ? `/contact?topic=${encodeURIComponent(topic)}` : '/contact'),
  faq: () => '/faq',
  privacy: () => '/privacy',
  terms: () => '/terms',
};

function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params)
      .filter(
        ([, v]) =>
          v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0),
      )
      .map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v)]),
  );
}

export const primaryNav = [
  { label: 'Discover', to: '/discover' },
  { label: 'Explore Businesses', to: '/businesses' },
  { label: 'Categories', to: '/businesses', menu: 'categories' },
  { label: 'Travel Guides', to: '/guides' },
  { label: 'About', to: '/about' },
];
