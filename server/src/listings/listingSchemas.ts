import { z } from 'zod';
import { isSafeHttpUrl } from '../utils/text.js';
import { csv, paginationQuery, searchText } from '../middleware/core.js';

const text = (max: number) => z.string().trim().max(max);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || isSafeHttpUrl(v), 'Must be a full http(s) URL');
const phone = z
  .string()
  .trim()
  .max(40)
  .refine((v) => v === '' || /^\+?[0-9 ()-]{7,20}$/.test(v), 'Enter a valid phone number');
const optionalEmail = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email address');
const optionalId = z.union([z.uuid(), z.literal(''), z.null()]).transform((v) => v || null);
const tagList = (maxItems: number, maxLen = 60) => z.array(text(maxLen).min(1)).max(maxItems);

export const LISTING_STATUSES = ['draft', 'pending', 'published', 'rejected', 'archived'] as const;

const locationInput = z.strictObject({
  countryId: optionalId.optional(),
  regionId: optionalId.optional(),
  cityId: optionalId.optional(),
  neighborhoodId: optionalId.optional(),
  address: text(300).optional(),
  postalCode: text(20).optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  displayPreference: z.enum(['full', 'area', 'hidden']).optional(),
});

const contactInput = z.strictObject({
  phone: phone.optional(),
  email: optionalEmail.optional(),
  website: optionalUrl.optional(),
  whatsapp: phone.optional(),
  bookingUrl: optionalUrl.optional(),
  socials: z
    .array(z.strictObject({ platform: text(40).min(1), url: optionalUrl.refine((v) => v !== '', 'URL required') }))
    .max(10)
    .optional(),
});

const detailsInput = z.strictObject({
  openingHours: z.array(z.strictObject({ day: text(40).min(1), hours: text(60).min(1) })).max(14).optional(),
  priceRange: text(20).optional(),
  amenities: tagList(40).optional(),
  accessibility: text(1000).optional(),
  languages: tagList(20, 40).optional(),
  audiences: tagList(10, 40).optional(),
  bookingRequirements: text(500).optional(),
  /** Private admin notes: never public, never indexed. */
  notes: text(4000).optional(),
  /** Public additional notes: shown on the listing page and available to the chatbot. */
  publicNotes: text(1000).optional(),
});

const mediaInput = z.strictObject({
  featuredImage: optionalUrl.optional(),
  featuredAlt: text(200).optional(),
  gallery: z.array(z.strictObject({ url: optionalUrl.refine((v) => v !== '', 'URL required'), alt: text(200) })).max(20).optional(),
});

const seoInput = z.strictObject({
  title: text(70).optional(),
  description: text(170).optional(),
  keywords: tagList(20).optional(),
  canonicalUrl: optionalUrl.optional(),
  searchVisible: z.boolean().optional(),
  indexing: z.enum(['index', 'noindex']).optional(),
});

const aiInput = z.strictObject({
  includeInChatbot: z.boolean().optional(),
  includeContact: z.boolean().optional(),
});

const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only');

const listingFields = {
  name: text(120).min(2, 'Business name is required'),
  slug: slug.optional(),
  shortDescription: text(200).optional(),
  description: text(8000).optional(),
  listingType: text(40).optional(),
  categoryId: optionalId.optional(),
  secondaryCategoryIds: z.array(z.uuid()).max(10).optional(),
  ownerUserId: optionalId.optional(),
  location: locationInput.optional(),
  contact: contactInput.optional(),
  details: detailsInput.optional(),
  media: mediaInput.optional(),
  seo: seoInput.optional(),
  ai: aiInput.optional(),
};

/** Status can only be draft/pending on create; publishing goes through the status endpoint. */
export const createListingSchema = z.strictObject({
  ...listingFields,
  status: z.enum(['draft', 'pending']).default('draft'),
});

export const updateListingSchema = z
  .strictObject({
    ...listingFields,
    name: listingFields.name.optional(),
    /** Optimistic concurrency: reject the update if someone saved a newer version meanwhile. */
    expectedVersion: z.number().int().min(1).optional(),
  })
  .refine((v) => Object.keys(v).some((k) => k !== 'expectedVersion'), 'No changes supplied');

export const statusChangeSchema = z
  .strictObject({
    status: z.enum(LISTING_STATUSES),
    reason: text(500).optional(),
    feedback: text(1000).optional(),
  })
  .refine((v) => v.status !== 'rejected' || (v.reason ?? '').length >= 3, {
    message: 'A rejection reason is required',
    path: ['reason'],
  });

export const bulkSchema = z.strictObject({
  action: z.enum(['publish', 'archive', 'draft', 'feature', 'unfeature', 'delete']),
  ids: z.array(z.uuid()).min(1).max(100),
});

export const adminListQuery = z.strictObject({
  ...paginationQuery,
  q: searchText(120).optional(),
  status: csv(z.enum(LISTING_STATUSES)).optional(),
  categoryId: z.uuid().optional(),
  locationId: z.uuid().optional(),
  featured: z.enum(['true', 'false']).optional(),
  includeInChatbot: z.enum(['true', 'false']).optional(),
  sort: z.enum(['name', 'updatedAt', 'createdAt', 'status']).default('updatedAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});

export const publicListQuery = z.strictObject({
  ...paginationQuery,
  q: searchText(120).optional(),
  category: slug.optional(),
  location: slug.optional(),
  featured: z.enum(['true', 'false']).optional(),
  sort: z.enum(['name', 'newest', 'featured']).default('featured'),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
