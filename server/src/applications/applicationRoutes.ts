import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app/context.js';
import { recordAudit } from '../audit/auditService.js';
import type { Database, Queryable } from '../database/db.js';
import { uniqueSlug } from '../listings/listingService.js';
import { resolveLocationPath } from '../locations/locationPath.js';
import { requirePermission } from '../middleware/auth.js';
import { body, csv, paged, paginationQuery, params, query, uuidParam, validate } from '../middleware/core.js';
import { createLimiter } from '../middleware/rateLimit.js';
import { afterSourceWrite } from '../sync/syncQueue.js';
import { badRequest, notFound } from '../utils/errors.js';
import { isSafeHttpUrl } from '../utils/text.js';

/**
 * Business sign-ups and content-provider applications.
 * A business application creates a PENDING listing (never published automatically) plus draft FAQs,
 * so it appears in Admin → Listing submissions for review. Everything else submitted is kept on the
 * application for the reviewer.
 */
const BUSINESS_PLANS = ['free', 'verified', 'business_plus', 'professional_partner', 'sponsored_category'] as const;
const STATUSES = ['new', 'in_review', 'approved', 'rejected'] as const;

const t = (max: number) => z.string().trim().max(max);
const optUrl = t(500).refine((v) => v === '' || isSafeHttpUrl(v), 'Must be a full http(s) URL').default('');
const phone = t(40).refine((v) => v === '' || /^\+?[0-9 ()-]{7,20}$/.test(v), 'Enter a valid phone number').default('');
const consent = z.literal(true, { message: 'Permission is required' });

const contact = {
  contactName: t(120).min(2, 'Contact name is required'),
  contactRole: t(80).default(''),
  contactEmail: z.email('Enter a valid email').max(200),
  contactPhone: phone,
};

export const businessApplicationSchema = z.strictObject({
  kind: z.literal('business'),
  plan: z.enum(BUSINESS_PLANS).default('free'),
  registeredName: t(160).min(2, 'Registered name is required'),
  tradingName: t(160).default(''),
  categoryId: z.uuid().optional(),
  categoryOther: t(80).default(''),
  description: t(2000).min(20, 'Describe the business (at least 20 characters)'),
  productsServices: t(2000).min(3, 'List your main products or services'),
  address: t(300).default(''),
  locationId: z.uuid().optional(),
  mapUrl: optUrl,
  phone,
  whatsapp: phone,
  email: z.union([z.email().max(200), z.literal('')]).default(''),
  website: optUrl,
  socialLinks: z.array(optUrl).max(6).default([]),
  openingHours: t(500).default(''),
  areasServed: t(500).default(''),
  priceRange: t(200).default(''),
  bookingPaymentDelivery: t(1000).default(''),
  faqs: z.array(z.strictObject({ question: t(300).min(5), answer: t(2000).min(2) })).max(10).default([]),
  mediaLinks: z.array(optUrl).max(10).default([]),
  registrationNumber: t(80).default(''),
  licenceNumber: t(80).default(''),
  ...contact,
  consentToUse: consent,
  infoAccurate: consent,
});

export const contributorApplicationSchema = z.strictObject({
  kind: z.literal('content_provider'),
  organisationName: t(160).min(2, 'Organisation or name is required'),
  contributorType: z.enum(['expert', 'university', 'government', 'cultural', 'other']),
  expertise: t(1000).min(10, 'Describe the topics you can contribute'),
  website: optUrl,
  sampleSources: z.array(optUrl).max(10).default([]),
  qualifications: t(1000).min(3, 'Qualifications are required'),
  publicationNotes: t(1000).default(''),
  correctionsEmail: z.email('Enter a valid email').max(200),
  ...contact,
  copyrightPermission: consent,
  consentToUse: consent,
});

export const applicationSchema = z.discriminatedUnion('kind', [businessApplicationSchema, contributorApplicationSchema]);
type BusinessApplication = z.infer<typeof businessApplicationSchema>;
type ContributorApplication = z.infer<typeof contributorApplicationSchema>;

export function publicApplicationRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;
  const limiter = createLimiter(ctx.config.RATE_LIMIT_WINDOW_MS * 10, Math.max(3, ctx.config.FEEDBACK_RATE_LIMIT_MAX), false);

  r.post('/', limiter, validate({ body: applicationSchema }), async (req, res) => {
    const b = body<BusinessApplication | ContributorApplication>(req);
    const result = await db.tx(async (client) => {
      let listingId: string | null = null;
      if (b.kind === 'business') {
        if (b.categoryId) {
          const c = await client.query(`select 1 from ${db.t('categories')} where id = $1 and active`, [b.categoryId]);
          if (!c.rowCount) throw badRequest('Choose a valid category.', { field: 'categoryId' });
        }
        const path = b.locationId ? await resolveLocationPath(client, db, await locationField(client, db, b.locationId)) : null;
        const name = b.tradingName || b.registeredName;
        const slug = await uniqueSlug(client, db, name);
        const description = [b.description, `Products and services: ${b.productsServices}`].join('\n\n');
        const publicNotes = [b.areasServed && `Areas served: ${b.areasServed}`, b.categoryOther && `Business type: ${b.categoryOther}`].filter(Boolean).join('\n');
        const privateNotes = [
          `Submitted via business sign-up (plan: ${b.plan}).`,
          `Registered name: ${b.registeredName}`,
          b.registrationNumber && `Company registration: ${b.registrationNumber}`,
          b.licenceNumber && `Professional licence: ${b.licenceNumber}`,
          `Authorised contact: ${b.contactName}${b.contactRole ? ` (${b.contactRole})` : ''}, ${b.contactEmail}${b.contactPhone ? `, ${b.contactPhone}` : ''}`,
          b.mapUrl && `Map: ${b.mapUrl}`,
          b.mediaLinks.length ? `Media: ${b.mediaLinks.join(' ')}` : '',
        ].filter(Boolean).join('\n');
        const firstImage = b.mediaLinks.find((u) => /\.(jpe?g|png|webp)(\?|$)/i.test(u)) ?? '';
        const row = await client.query<{ id: string; content_version: number }>(
          `insert into ${db.t('listings')}
             (name, slug, short_description, description, primary_category_id, country_id, region_id, city_id, neighborhood_id,
              street_address, phone, whatsapp, email, website_url, social_links, opening_hours, price_range,
              booking_requirements, public_notes, private_notes, images, status, include_in_chatbot, info_confirmed_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'pending',true,current_date)
           returning id, content_version`,
          [
            name.slice(0, 120),
            slug,
            b.description.slice(0, 200),
            description.slice(0, 8000),
            b.categoryId ?? null,
            path?.countryId ?? null,
            path?.regionId ?? null,
            path?.cityId ?? null,
            path?.neighborhoodId ?? null,
            b.address,
            b.phone,
            b.whatsapp,
            b.email,
            b.website,
            JSON.stringify(b.socialLinks.filter(Boolean).map((url) => ({ platform: new URL(url).hostname.replace(/^www\./, ''), url }))),
            JSON.stringify(b.openingHours ? [{ day: 'Opening hours', hours: b.openingHours.slice(0, 60) }] : []),
            b.priceRange.slice(0, 20),
            b.bookingPaymentDelivery.slice(0, 500),
            publicNotes.slice(0, 1000),
            privateNotes.slice(0, 4000),
            JSON.stringify(firstImage ? { featuredImage: firstImage, featuredAlt: name, gallery: [] } : {}),
          ],
        );
        listingId = row.rows[0].id;
        for (const [i, f] of b.faqs.entries()) {
          await client.query(
            `insert into ${db.t('faqs')} (question, answer, category_id, related_listing_id, status, approval_status, display_order)
             values ($1, $2, $3, $4, 'draft', 'pending', $5)`,
            [f.question, f.answer, b.categoryId ?? null, listingId, 1000 + i],
          );
        }
        await afterSourceWrite(client, db, { sourceType: 'listing', sourceId: listingId, version: row.rows[0].content_version, eligible: false });
      }
      const app = await client.query<{ id: string }>(
        `insert into ${db.t('applications')} (kind, plan, organisation_name, contact_name, contact_role, contact_email, contact_phone, details, consent_to_use, listing_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,true,$9) returning id`,
        [
          b.kind,
          b.kind === 'business' ? b.plan : 'contributor',
          b.kind === 'business' ? b.tradingName || b.registeredName : b.organisationName,
          b.contactName,
          b.contactRole,
          b.contactEmail.toLowerCase(),
          b.contactPhone,
          JSON.stringify(b),
          listingId,
        ],
      );
      await recordAudit(client, db, req, {
        action: b.kind === 'business' ? 'listing.submitted' : 'contributor.applied',
        entityType: b.kind === 'business' ? 'listing' : 'application',
        entityId: listingId ?? app.rows[0].id,
        entityName: b.kind === 'business' ? b.tradingName || b.registeredName : b.organisationName,
        summary: b.kind === 'business' ? `Business sign-up (${b.plan})` : `Content provider application (${b.contributorType})`,
      });
      return { id: app.rows[0].id, listingId };
    });
    res.status(201).json({ received: true, applicationId: result.id, status: 'new' });
  });

  return r;
}

/** Map a single location id to the right path field based on its type. */
async function locationField(client: Queryable, db: Database, id: string) {
  const r = await client.query<{ type: string }>(`select type from ${db.t('locations')} where id = $1`, [id]);
  const field = ({ country: 'countryId', region: 'regionId', city: 'cityId', neighborhood: 'neighborhoodId' } as const)[r.rows[0]?.type as 'country'];
  if (!field) throw badRequest('Choose a valid location.', { field: 'locationId' });
  return { [field]: id };
}

export function adminApplicationRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;
  const SELECT = `a.id, a.kind, a.plan, a.status, a.organisation_name as "organisationName", a.contact_name as "contactName",
    a.contact_role as "contactRole", a.contact_email as "contactEmail", a.contact_phone as "contactPhone", a.details,
    a.listing_id as "listingId", l.status as "listingStatus", l.verified as "listingVerified", a.review_note as "reviewNote",
    a.reviewed_at as "reviewedAt", a.created_at as "createdAt", a.updated_at as "updatedAt"`;

  r.get(
    '/',
    requirePermission('listings:read'),
    validate({ query: z.strictObject({ ...paginationQuery, status: csv(z.enum(STATUSES)).optional(), kind: z.enum(['business', 'content_provider']).optional() }) }),
    async (req, res) => {
      const f = query<{ page: number; pageSize: number; status?: string[]; kind?: string }>(req);
      const where: string[] = [];
      const p: unknown[] = [];
      if (f.status?.length) {
        p.push(f.status);
        where.push(`a.status = any($${p.length})`);
      }
      if (f.kind) {
        p.push(f.kind);
        where.push(`a.kind = $${p.length}`);
      }
      const w = where.length ? `where ${where.join(' and ')}` : '';
      const total = await db.one<{ n: number }>(`select count(*)::int as n from ${db.t('applications')} a ${w}`, p);
      const rows = await db.many(
        `select ${SELECT} from ${db.t('applications')} a left join ${db.t('listings')} l on l.id = a.listing_id ${w}
          order by a.created_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`,
        p,
      );
      res.json(paged(rows, total?.n ?? 0, f.page, f.pageSize));
    },
  );

  r.get('/:id', requirePermission('listings:read'), validate({ params: uuidParam }), async (req, res) => {
    const row = await db.one(`select ${SELECT} from ${db.t('applications')} a left join ${db.t('listings')} l on l.id = a.listing_id where a.id = $1`, [
      params<{ id: string }>(req).id,
    ]);
    if (!row) throw notFound('Application');
    res.json(row);
  });

  r.patch(
    '/:id',
    requirePermission('listings:publish'),
    validate({ params: uuidParam, body: z.strictObject({ status: z.enum(STATUSES), reviewNote: t(1000).optional() }) }),
    async (req, res) => {
      const id = params<{ id: string }>(req).id;
      const b = body<{ status: string; reviewNote?: string }>(req);
      const row = await db.tx(async (client) => {
        const u = await client.query(
          `update ${db.t('applications')} set status = $2, review_note = coalesce($3, review_note), reviewed_by = $4, reviewed_at = now()
            where id = $1 returning id, status, organisation_name`,
          [id, b.status, b.reviewNote ?? null, req.admin!.id],
        );
        if (!u.rowCount) throw notFound('Application');
        await recordAudit(client, db, req, { action: `application.${b.status}`, entityType: 'application', entityId: id, entityName: u.rows[0].organisation_name });
        return u.rows[0];
      });
      res.json(row);
    },
  );

  return r;
}
