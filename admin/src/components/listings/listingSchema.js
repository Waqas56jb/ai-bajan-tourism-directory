import { z } from 'zod';
import {
  SLUG_PATTERN,
  isValidLatitude,
  isValidLongitude,
  isValidPhone,
  isValidUrl,
} from '@/utils/validation';

const optionalUrl = (msg = 'Enter a full URL starting with https://') =>
  z
    .string()
    .trim()
    .refine((v) => !v || isValidUrl(v), msg);

const optionalPhone = z
  .string()
  .trim()
  .refine((v) => !v || isValidPhone(v), 'Enter a valid phone number, e.g. +1 246 555 0100.');

export const listingSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Business name is required.')
      .max(120, 'Keep the name under 120 characters.'),
    slug: z
      .string()
      .trim()
      .min(2, 'Slug is required.')
      .max(80)
      .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and hyphens only.'),
    shortDescription: z
      .string()
      .trim()
      .min(10, 'Add a short description (at least 10 characters).')
      .max(160, 'Keep it under 160 characters.'),
    description: z
      .string()
      .trim()
      .min(30, 'Add a fuller description (at least 30 characters).')
      .max(4000, 'Keep it under 4,000 characters.'),
    listingType: z.string().min(1, 'Choose a listing type.'),
    categoryId: z.string().min(1, 'Choose a primary category.'),
    secondaryCategoryIds: z.array(z.string()),
    status: z.enum(['draft', 'pending', 'published', 'rejected', 'archived']),
    location: z.object({
      countryId: z.string().min(1, 'Choose a country.'),
      regionId: z.string().min(1, 'Choose an island or region.'),
      cityId: z.string().min(1, 'Choose a city or town.'),
      neighborhoodId: z.string(),
      address: z.string().trim().max(200),
      postalCode: z.string().trim().max(20),
      lat: z.union([z.string(), z.number()]),
      lng: z.union([z.string(), z.number()]),
      displayPreference: z.enum(['exact', 'area', 'hidden']),
    }),
    contact: z.object({
      phone: optionalPhone,
      email: z
        .string()
        .trim()
        .refine((v) => !v || z.string().email().safeParse(v).success, 'Enter a valid email address.'),
      website: optionalUrl(),
      whatsapp: optionalPhone,
      bookingUrl: optionalUrl(),
      socials: z.array(
        z.object({
          platform: z.string().trim().min(1, 'Platform name required.'),
          url: optionalUrl().refine((v) => Boolean(v), 'URL required.'),
        }),
      ),
    }),
    details: z.object({
      openingHours: z.array(
        z.object({ day: z.string().trim().min(1, 'Required'), hours: z.string().trim().min(1, 'Required') }),
      ),
      priceRange: z.string(),
      amenities: z.array(z.string()),
      accessibility: z.string().max(500),
      languages: z.array(z.string()),
      audiences: z.array(z.string()),
      bookingRequirements: z.string().max(300),
      notes: z.string().max(500),
    }),
    media: z.object({
      featuredImage: z.string().trim(),
      featuredAlt: z.string().trim().max(150),
      gallery: z.array(
        z.object({ url: z.string().trim().min(1, 'Image URL required.'), alt: z.string().trim().max(150) }),
      ),
    }),
    seo: z.object({
      title: z.string().trim().max(70, 'Keep SEO titles under 70 characters.'),
      description: z.string().trim().max(170, 'Keep meta descriptions under 170 characters.'),
      keywords: z.array(z.string()),
      canonicalUrl: optionalUrl(),
      searchVisible: z.boolean(),
      indexing: z.enum(['index', 'noindex']),
    }),
    ai: z.object({
      includeInChatbot: z.boolean(),
      includeDescription: z.boolean(),
      includeContact: z.boolean(),
      excludePrivateNotes: z.boolean(),
      indexingStatus: z.string(),
      lastIndexedAt: z.string().nullable(),
    }),
    internalNotes: z.string().max(1000),
    featured: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const { lat, lng } = v.location;
    const hasLat = lat !== '' && lat !== null && lat !== undefined;
    const hasLng = lng !== '' && lng !== null && lng !== undefined;
    if (hasLat !== hasLng)
      ctx.addIssue({
        path: [hasLat ? 'location.lng' : 'location.lat'].map((p) => p.split('.')).flat(),
        code: 'custom',
        message: 'Enter both latitude and longitude, or neither.',
      });
    if (hasLat && !isValidLatitude(lat))
      ctx.addIssue({
        path: ['location', 'lat'],
        code: 'custom',
        message: 'Latitude must be between -90 and 90.',
      });
    if (hasLng && !isValidLongitude(lng))
      ctx.addIssue({
        path: ['location', 'lng'],
        code: 'custom',
        message: 'Longitude must be between -180 and 180.',
      });
    if (v.media.featuredImage && !v.media.featuredAlt)
      ctx.addIssue({
        path: ['media', 'featuredAlt'],
        code: 'custom',
        message: 'Describe the image for screen-reader users.',
      });
    if (
      v.media.featuredImage &&
      !v.media.featuredImage.startsWith('blob:') &&
      !isValidUrl(v.media.featuredImage)
    ) {
      ctx.addIssue({
        path: ['media', 'featuredImage'],
        code: 'custom',
        message: 'Enter a full image URL starting with https://',
      });
    }
    if (v.secondaryCategoryIds.includes(v.categoryId))
      ctx.addIssue({
        path: ['secondaryCategoryIds'],
        code: 'custom',
        message: 'Secondary categories can’t include the primary category.',
      });
  });

export function emptyListing(defaults = {}) {
  return {
    name: '',
    slug: '',
    shortDescription: '',
    description: '',
    listingType: 'Business',
    categoryId: '',
    secondaryCategoryIds: [],
    status: defaults.status ?? 'draft',
    location: {
      countryId: 'loc-barbados',
      regionId: '',
      cityId: '',
      neighborhoodId: '',
      address: '',
      postalCode: '',
      lat: '',
      lng: '',
      displayPreference: 'area',
    },
    contact: { phone: '', email: '', website: '', whatsapp: '', bookingUrl: '', socials: [] },
    details: {
      openingHours: [],
      priceRange: '',
      amenities: [],
      accessibility: '',
      languages: ['English'],
      audiences: [],
      bookingRequirements: '',
      notes: '',
    },
    media: { featuredImage: '', featuredAlt: '', gallery: [] },
    seo: {
      title: '',
      description: '',
      keywords: [],
      canonicalUrl: '',
      searchVisible: defaults.searchVisible ?? true,
      indexing: 'index',
    },
    ai: {
      includeInChatbot: defaults.includeInChatbot ?? true,
      includeDescription: true,
      includeContact: true,
      excludePrivateNotes: true,
      indexingStatus: 'not_indexed',
      lastIndexedAt: null,
    },
    internalNotes: '',
    featured: defaults.featured ?? false,
  };
}

/** Normalise a stored listing into form values (fills any missing fields). */
export function listingToForm(listing) {
  const base = emptyListing();
  return {
    ...base,
    ...listing,
    location: {
      ...base.location,
      ...listing.location,
      lat: listing.location?.lat ?? '',
      lng: listing.location?.lng ?? '',
    },
    contact: { ...base.contact, ...listing.contact },
    details: { ...base.details, ...listing.details },
    media: { ...base.media, ...listing.media },
    seo: { ...base.seo, ...listing.seo },
    ai: { ...base.ai, ...listing.ai },
    internalNotes: listing.internalNotes ?? '',
  };
}

/** Convert form values to the stored shape (numbers for coordinates). */
export function formToListing(values) {
  const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  return {
    ...values,
    location: { ...values.location, lat: num(values.location.lat), lng: num(values.location.lng) },
  };
}
