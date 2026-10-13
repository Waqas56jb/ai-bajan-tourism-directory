import type { CreateListingInput, UpdateListingInput } from './listingSchemas.js';

export interface ListingRow {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  listing_type: string;
  primary_category_id: string | null;
  secondary_category_ids: string[];
  country_id: string | null;
  region_id: string | null;
  city_id: string | null;
  neighborhood_id: string | null;
  street_address: string;
  postal_code: string;
  address_display: 'full' | 'area' | 'hidden';
  latitude: number | null;
  longitude: number | null;
  phone: string;
  email: string;
  website_url: string;
  whatsapp: string;
  booking_url: string;
  social_links: Array<{ platform: string; url: string }>;
  opening_hours: Array<{ day: string; hours: string }>;
  price_range: string;
  amenities: string[];
  accessibility: string;
  languages: string[];
  audiences: string[];
  booking_requirements: string;
  images: { featuredImage?: string; featuredAlt?: string; gallery?: Array<{ url: string; alt: string }> };
  seo: Record<string, unknown>;
  status: string;
  featured: boolean;
  include_in_chatbot: boolean;
  chatbot_include_contact: boolean;
  rejection_reason: string;
  review_feedback: string;
  private_notes: string;
  public_notes: string;
  owner_user_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  content_version: number;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  archived_at: Date | null;
  // joined
  category_name?: string | null;
  category_slug?: string | null;
  region_name?: string | null;
  city_name?: string | null;
  neighborhood_name?: string | null;
  index_status?: string | null;
  last_indexed_at?: Date | null;
  chunk_count?: number | null;
}

/** API field → column. Only these keys can ever be written. */
export const LISTING_COLUMNS: Record<string, string> = {
  name: 'name',
  slug: 'slug',
  shortDescription: 'short_description',
  description: 'description',
  listingType: 'listing_type',
  categoryId: 'primary_category_id',
  secondaryCategoryIds: 'secondary_category_ids',
  ownerUserId: 'owner_user_id',
  countryId: 'country_id',
  regionId: 'region_id',
  cityId: 'city_id',
  neighborhoodId: 'neighborhood_id',
  address: 'street_address',
  postalCode: 'postal_code',
  displayPreference: 'address_display',
  lat: 'latitude',
  lng: 'longitude',
  phone: 'phone',
  email: 'email',
  website: 'website_url',
  whatsapp: 'whatsapp',
  bookingUrl: 'booking_url',
  socials: 'social_links',
  openingHours: 'opening_hours',
  priceRange: 'price_range',
  amenities: 'amenities',
  accessibility: 'accessibility',
  languages: 'languages',
  audiences: 'audiences',
  bookingRequirements: 'booking_requirements',
  notes: 'private_notes',
  publicNotes: 'public_notes',
  media: 'images',
  seo: 'seo',
  includeInChatbot: 'include_in_chatbot',
  includeContact: 'chatbot_include_contact',
  status: 'status',
};

export const LISTING_JSON_COLUMNS = new Set(['social_links', 'opening_hours', 'images', 'seo']);

/** Flatten nested API input into the column-keyed object used by buildSet(). */
export function flattenListingInput(input: Partial<CreateListingInput> & Partial<UpdateListingInput>, current?: ListingRow) {
  const flat: Record<string, unknown> = {
    name: input.name,
    slug: input.slug,
    shortDescription: input.shortDescription,
    description: input.description,
    listingType: input.listingType,
    categoryId: input.categoryId,
    secondaryCategoryIds: input.secondaryCategoryIds,
    ownerUserId: input.ownerUserId,
    status: 'status' in input ? input.status : undefined,
    ...input.location,
    ...input.contact,
    ...input.details,
    includeInChatbot: input.ai?.includeInChatbot,
    includeContact: input.ai?.includeContact,
  };
  // media / seo are stored as validated JSON objects; partial updates merge onto the current value.
  if (input.media) flat.media = { ...(current?.images ?? {}), ...input.media };
  if (input.seo) flat.seo = { ...(current?.seo ?? {}), ...input.seo };
  return flat;
}

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

/** Full admin representation (includes private notes and review fields). */
export function toAdminListing(r: ListingRow) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    shortDescription: r.short_description,
    description: r.description,
    listingType: r.listing_type,
    categoryId: r.primary_category_id,
    categoryName: r.category_name ?? null,
    secondaryCategoryIds: r.secondary_category_ids,
    status: r.status,
    featured: r.featured,
    location: {
      countryId: r.country_id,
      regionId: r.region_id,
      cityId: r.city_id,
      neighborhoodId: r.neighborhood_id,
      address: r.street_address,
      postalCode: r.postal_code,
      lat: r.latitude,
      lng: r.longitude,
      displayPreference: r.address_display,
      label: [r.neighborhood_name, r.city_name, r.region_name].filter(Boolean).join(', '),
    },
    contact: {
      phone: r.phone,
      email: r.email,
      website: r.website_url,
      whatsapp: r.whatsapp,
      bookingUrl: r.booking_url,
      socials: r.social_links,
    },
    details: {
      openingHours: r.opening_hours,
      priceRange: r.price_range,
      amenities: r.amenities,
      accessibility: r.accessibility,
      languages: r.languages,
      audiences: r.audiences,
      bookingRequirements: r.booking_requirements,
      notes: r.private_notes,
      publicNotes: r.public_notes ?? '',
    },
    media: {
      featuredImage: r.images.featuredImage ?? '',
      featuredAlt: r.images.featuredAlt ?? '',
      gallery: r.images.gallery ?? [],
    },
    seo: r.seo,
    ai: {
      includeInChatbot: r.include_in_chatbot,
      includeContact: r.chatbot_include_contact,
      indexingStatus: r.index_status ?? 'not_indexed',
      lastIndexedAt: iso(r.last_indexed_at),
      chunkCount: r.chunk_count ?? 0,
    },
    review: { rejectionReason: r.rejection_reason, feedback: r.review_feedback },
    ownerUserId: r.owner_user_id,
    version: r.content_version,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    publishedAt: iso(r.published_at),
    archivedAt: iso(r.archived_at),
  };
}

/**
 * Public representation: published content only. Private notes, review feedback, owner, internal
 * flags and (unless the listing allows it) the street address are omitted.
 */
export function toPublicListing(r: ListingRow) {
  const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : '');
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    shortDescription: r.short_description,
    description: r.description,
    listingType: r.listing_type,
    category: r.primary_category_id ? { id: r.primary_category_id, name: r.category_name ?? '', slug: r.category_slug ?? '' } : null,
    featured: r.featured,
    location: {
      area: [r.neighborhood_name, r.city_name, r.region_name].filter(Boolean).join(', '),
      address: r.address_display === 'full' ? r.street_address : '',
      lat: r.address_display === 'hidden' ? null : r.latitude,
      lng: r.address_display === 'hidden' ? null : r.longitude,
    },
    contact: {
      phone: r.phone,
      email: r.email,
      website: safeUrl(r.website_url),
      whatsapp: r.whatsapp,
      bookingUrl: safeUrl(r.booking_url),
      socials: r.social_links.filter((s) => safeUrl(s.url)),
    },
    details: {
      openingHours: r.opening_hours,
      priceRange: r.price_range,
      amenities: r.amenities,
      accessibility: r.accessibility,
      languages: r.languages,
      bookingRequirements: r.booking_requirements,
      notes: r.public_notes ?? '',
    },
    media: {
      featuredImage: safeUrl(r.images.featuredImage ?? ''),
      featuredAlt: r.images.featuredAlt ?? '',
      gallery: (r.images.gallery ?? []).filter((g) => safeUrl(g.url)),
    },
    seo: { title: (r.seo.title as string) ?? '', description: (r.seo.description as string) ?? '' },
    updatedAt: iso(r.updated_at),
  };
}
