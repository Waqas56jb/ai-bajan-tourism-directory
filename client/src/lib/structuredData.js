/**
 * JSON-LD builders. Only fields that exist on real records are emitted: demo listings never
 * produce LocalBusiness data, and ratings / reviews / addresses are never fabricated.
 */
import { SITE_NAME, SITE_URL } from './config';
import { getImage } from './imageSources';

function absolute(url) {
  if (!url) return undefined;
  return /^https?:\/\//.test(url) ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/businesses?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.to ? { item: absolute(item.to) } : {}),
    })),
  };
}

/**
 * LocalBusiness template. Returns null for demo content. Only includes fields that exist on
 * the record — no invented address, rating, review or hours.
 */
export function localBusinessJsonLd(business) {
  if (!business || business.demoContent) return null;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.name,
    description: business.shortDescription || business.description,
    url: absolute(`/business/${business.slug}`),
    areaServed: business.area,
  };
  if (business.images?.[0]) data.image = absolute(getImage(business.images[0]).src);
  if (business.phone) data.telephone = business.phone;
  if (business.email) data.email = business.email;
  if (business.website) data.sameAs = [business.website];
  if (business.address) {
    data.address = {
      '@type': 'PostalAddress',
      streetAddress: business.address,
      addressLocality: business.area,
      addressRegion: business.parish,
      addressCountry: 'BB',
    };
  }
  if (business.coordinates) {
    data.geo = {
      '@type': 'GeoCoordinates',
      latitude: business.coordinates.lat,
      longitude: business.coordinates.lng,
    };
  }
  return data;
}

export function articleJsonLd(guide) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.excerpt,
    image: absolute(getImage(guide.image, { width: 1200 }).src),
    mainEntityOfPage: absolute(`/guides/${guide.slug}`),
    publisher: { '@type': 'Organization', name: SITE_NAME },
  };
  if (guide.author) data.author = { '@type': 'Person', name: guide.author };
  if (guide.publishedAt) data.datePublished = guide.publishedAt;
  return data;
}

export function faqJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}
