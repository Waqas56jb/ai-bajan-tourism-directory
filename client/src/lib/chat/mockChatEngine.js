/**
 * DEMO chat engine — deterministic, rules-based retrieval over the bundled sample data.
 *
 * This is NOT an AI model and is never presented as one. It exists so the chat UI can be
 * built and tested before the Node.js + OpenAI RAG service exists. The production server must
 * do its own retrieval, validation and generation; this file will not be used in live mode.
 *
 * Response contract (shared with the live API):
 * {
 *   reply: string (Markdown),
 *   businesses: BusinessSummary[],
 *   sources: { type: 'listing'|'guide'|'page', title: string, url: string }[],
 *   followUps: string[],
 *   meta: { mode: 'demo'|'live', category?: string, location?: string }
 * }
 */
import { categoryBySlug, categories } from '@/data/categories';
import { destinations } from '@/data/destinations';
import { travelGuides } from '@/data/travelGuides';
import { getAmenityLabel } from '@/data/amenities';
import {
  interpretQuery,
  matchesLocation,
  describeLocation,
  scoreBusiness,
  normalize,
} from '@/lib/search';
import { routes } from '@/lib/routes';

const MAX_RESULTS = 4;

const LIVE_WORDS = new Set([
  'open',
  'now',
  'hour',
  'price',
  'cost',
  'much',
  'availability',
  'tonight',
  'today',
  'tomorrow',
  'book',
  'booking',
  'reserve',
  'reservation',
  'weather',
  'cheap',
  'cheapest',
  'opening',
]);

const GREETING = /^(hi|hello|hey|good (morning|afternoon|evening)|yo|hiya)\b/;
const THANKS = /^(thanks|thank you|cheers|ty)\b/;
const OVERVIEW =
  /\b(what can you do|help|tourism|tourist information|travel information|what (information|info) is available|how does this work)\b/;
const LIVE_INFO =
  /\b(open now|opening hours|hours|price|prices|cost|costs|how much|availability|available tonight|book|booking|reserve|reservation|weather|today|tonight|tomorrow)\b/;

export function toSummary(b) {
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    category: b.category,
    categoryName: categoryBySlug[b.category]?.shortName ?? b.category,
    area: b.area,
    parish: b.parish,
    shortDescription: b.shortDescription,
    image: b.images?.[0] ?? null,
    isSponsored: !!b.isSponsored,
    isFeatured: !!b.isFeatured,
    demoContent: !!b.demoContent,
  };
}

function listingSource(b) {
  return { type: 'listing', title: b.name, url: routes.business(b.slug) };
}

function guideSourcesFor(categorySlugs) {
  return travelGuides
    .filter((g) => g.relatedCategories.some((c) => categorySlugs.includes(c)))
    .slice(0, 1)
    .map((g) => ({ type: 'guide', title: g.title, url: routes.guide(g.slug) }));
}

function directoryLink(categorySlug, location) {
  return routes.businesses({
    category: categorySlug,
    location: typeof location === 'string' ? location : (location?.area ?? location?.parish),
  });
}

function joinNames(list) {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
}

function retrieve(businesses, { categories: cats, location, amenities, keywordTokens }) {
  return businesses
    .filter((b) => b.status === 'published')
    .filter((b) => !cats.length || cats.some((c) => (b.categories ?? [b.category]).includes(c)))
    .filter((b) => matchesLocation(b, location))
    .filter((b) => amenities.every((a) => b.amenities?.includes(a)))
    .map((b) => ({ b, score: scoreBusiness(b, keywordTokens) }))
    .filter(({ score }) => score > 0)
    .sort((x, y) => y.score - x.score || x.b.name.localeCompare(y.b.name))
    .map(({ b }) => b);
}

function describeAsk({ categories: cats, location, amenities, keywordTokens }) {
  const catWords = cats.map((c) => categoryBySlug[c].shortName.toLowerCase());
  const keywords = keywordTokens.join(' ');
  const what = keywords
    ? `“${keywords}”${catWords.length ? ` ${joinNames(catWords)}` : ' listings'}`
    : catWords.length
      ? joinNames(catWords)
      : 'listings';
  const extras = amenities.length
    ? ` (${amenities.map(getAmenityLabel).join(', ').toLowerCase()})`
    : '';
  const where = location ? ` in ${describeLocation(location)}` : '';
  return `${what}${extras}${where}`;
}

function overviewResponse(businesses) {
  const counts = categories
    .map((c) => ({
      c,
      n: businesses.filter((b) => (b.categories ?? [b.category]).includes(c.slug)).length,
    }))
    .filter(({ n }) => n > 0);
  return {
    reply: [
      'Here’s what I can help with from the AI Bajan directory and travel guides:',
      '',
      ...counts.map(({ c, n }) => `- **${c.name}** — ${n} ${n === 1 ? 'listing' : 'listings'}`),
      '',
      `I can also point you to guides on areas such as ${joinNames(destinations.slice(0, 4).map((d) => d.name))}. I don’t have live prices, availability or opening hours unless a business has supplied them.`,
    ].join('\n'),
    businesses: [],
    sources: [
      { type: 'page', title: 'Explore all businesses', url: routes.businesses() },
      { type: 'guide', title: travelGuides[0].title, url: routes.guide(travelGuides[0].slug) },
    ],
    followUps: [
      'Find restaurants near Holetown.',
      'Show guesthouses in Christ Church.',
      'Find snorkeling tours.',
    ],
  };
}

function businessContextResponse(business, text, allBusinesses) {
  const n = normalize(text);
  const sources = [listingSource(business)];

  if (/\b(similar|nearby|near|around|alternative|alternatives|other)\b/.test(n)) {
    const related = allBusinesses
      .filter((b) => b.id !== business.id && b.category === business.category)
      .filter((b) => b.area === business.area || b.parish === business.parish);
    if (!related.length) {
      return {
        reply: `I couldn’t find other ${categoryBySlug[business.category].shortName.toLowerCase()} listings in ${business.area} or ${business.parish} in the directory right now.`,
        businesses: [],
        sources,
        followUps: [`Show all ${categoryBySlug[business.category].shortName.toLowerCase()}.`],
      };
    }
    return {
      reply: `Here are other ${categoryBySlug[business.category].shortName.toLowerCase()} listings in ${related.every((b) => b.area === business.area) ? business.area : `${business.parish} parish`}:`,
      businesses: related.slice(0, MAX_RESULTS).map(toSummary),
      sources,
      followUps: [],
    };
  }

  if (/\b(hours|open|opening|close|closing)\b/.test(n)) {
    if (business.openingHours?.length) {
      return {
        reply: [
          `The listing for **${business.name}** includes these opening hours:`,
          '',
          ...business.openingHours.map((h) => `- ${h.days}: ${h.hours}`),
          '',
          business.demoContent
            ? '_This is a demo listing, so these hours are sample data._'
            : 'Hours can change — please confirm with the business before visiting.',
        ].join('\n'),
        businesses: [],
        sources,
        followUps: ['How can I contact them?'],
      };
    }
    return {
      reply: `The listing for **${business.name}** doesn’t include opening hours, so I can’t tell you when it’s open. Contacting the business directly is the best way to check.`,
      businesses: [],
      sources,
      followUps: ['How can I contact them?'],
    };
  }

  if (/\b(contact|phone|call|email|website|reach)\b/.test(n)) {
    const channels = [
      business.website && 'website',
      business.phone && 'phone number',
      business.email && 'email address',
    ].filter(Boolean);
    return {
      reply: channels.length
        ? `The listing for **${business.name}** includes a ${joinNames(channels)}. You’ll find them in the contact panel on the listing page.${business.demoContent ? ' As this is a demo listing, those details are placeholders and won’t reach a real business.' : ''}`
        : `The listing for **${business.name}** doesn’t include contact details yet.`,
      businesses: [toSummary(business)],
      sources,
      followUps: [],
    };
  }

  if (LIVE_INFO.test(n)) {
    return {
      reply: `I don’t have live prices, availability or booking information for **${business.name}**. Please contact the business directly for up-to-date details.`,
      businesses: [toSummary(business)],
      sources,
      followUps: ['How can I contact them?', 'Show similar businesses nearby.'],
    };
  }

  const amenityText = business.amenities?.length
    ? `\n\n**Listed amenities:** ${business.amenities.map(getAmenityLabel).join(', ')}.`
    : '';
  const highlights = business.highlights?.length
    ? `\n\n**Highlights:** ${business.highlights.join(' · ')}.`
    : '';
  return {
    reply: `**${business.name}** is listed under ${categoryBySlug[business.category].name} in ${business.area}, ${business.parish}.\n\n${business.description}${highlights}${amenityText}`,
    businesses: [toSummary(business)],
    sources,
    followUps: [
      'What are the opening hours?',
      'How can I contact them?',
      'Show similar businesses nearby.',
    ],
  };
}

/**
 * Produce a deterministic demo response.
 * @param {{ message: string, context?: { businessSlug?: string } }} payload
 * @param {object[]} businesses
 */
export function generateMockReply({ message, context }, businesses) {
  const text = String(message ?? '').trim();
  const n = normalize(text);
  const contextBusiness = context?.businessSlug
    ? businesses.find((b) => b.slug === context.businessSlug)
    : null;

  if (!n) {
    return {
      reply:
        'Ask me about restaurants, stays, tours or places around Barbados and I’ll search the directory.',
      businesses: [],
      sources: [],
      followUps: ['Find restaurants near Holetown.'],
    };
  }

  if (GREETING.test(n) && n.split(' ').length <= 3) {
    return {
      reply:
        'Hello! Tell me what you’re looking for — a type of business, an area, or both — and I’ll search the AI Bajan directory.',
      businesses: [],
      sources: [],
      followUps: [
        'Find restaurants near Holetown.',
        'Show guesthouses in Christ Church.',
        'Find snorkeling tours.',
      ],
    };
  }

  if (THANKS.test(n)) {
    return {
      reply: 'You’re welcome! Anything else you’d like to find?',
      businesses: [],
      sources: [],
      followUps: [],
    };
  }

  const parsed = interpretQuery(text);
  const asksLiveInfo = LIVE_INFO.test(n);
  // Live-information words ("open today", "price") can't be answered from listings, so they
  // must not be treated as keywords that a listing has to contain.
  const intent = {
    ...parsed,
    keywordTokens: parsed.keywordTokens.filter((t) => !LIVE_WORDS.has(t)),
  };
  const hasDirectoryIntent =
    intent.categories.length > 0 || intent.location || intent.amenities.length > 0;

  if (contextBusiness && !intent.categories.length && !intent.location) {
    return businessContextResponse(contextBusiness, text, businesses);
  }

  if (!hasDirectoryIntent && OVERVIEW.test(n)) return overviewResponse(businesses);

  if (!hasDirectoryIntent && asksLiveInfo) {
    return {
      reply:
        'I don’t have live information such as weather, prices, availability or bookings. I can help you find businesses and travel information in the AI Bajan directory — for example, restaurants in a particular area.',
      businesses: [],
      sources: [],
      followUps: ['Find restaurants near Holetown.', 'What tourism information is available?'],
    };
  }

  if (!hasDirectoryIntent && !intent.keywordTokens.length) return overviewResponse(businesses);

  const matches = retrieve(businesses, intent);
  const ask = describeAsk(intent);
  const primaryCategory = intent.categories[0];

  if (matches.length) {
    const shown = matches.slice(0, MAX_RESULTS);
    const more = matches.length > shown.length ? ` Showing the first ${shown.length}.` : '';
    const demoNote = shown.some((b) => b.demoContent)
      ? '\n\n_These are demo listings used to preview the directory._'
      : '';
    const liveNote = asksLiveInfo
      ? '\n\nI can’t check live opening hours, prices or availability — please confirm those directly with each business.'
      : '';
    return {
      reply: `I found **${matches.length}** ${matches.length === 1 ? 'match' : 'matches'} for ${ask} in the directory.${more}${liveNote}${demoNote}`,
      businesses: shown.map(toSummary),
      sources: [
        ...(matches.length > shown.length
          ? [
              {
                type: 'page',
                title: 'See all results in the directory',
                url: directoryLink(primaryCategory, intent.location),
              },
            ]
          : []),
        ...guideSourcesFor(intent.categories),
      ],
      followUps: buildFollowUps(intent),
      meta: { category: primaryCategory, location: describeLocation(intent.location) },
    };
  }

  // Nothing matched exactly. Offer an explicitly labelled fallback in the same parish only.
  let fallback = [];
  let fallbackNote = '';
  if (intent.location?.area && intent.categories.length) {
    const parish = destinations.find((d) => d.filter.area === intent.location.area)?.parish;
    if (parish) {
      fallback = retrieve(businesses, { ...intent, location: { parish } });
      if (fallback.length)
        fallbackNote = `\n\nIn the same parish (**${parish}**), I found these instead:`;
    }
  }

  return {
    reply: `I couldn’t find any ${ask} in the directory.${fallbackNote || ' Try a broader search, a nearby area, or a different category.'}`,
    businesses: fallback.slice(0, MAX_RESULTS).map(toSummary),
    sources: primaryCategory
      ? [
          {
            type: 'page',
            title: `Browse all ${categoryBySlug[primaryCategory].shortName.toLowerCase()}`,
            url: routes.category(primaryCategory),
          },
        ]
      : [{ type: 'page', title: 'Explore all businesses', url: routes.businesses() }],
    followUps: ['What tourism information is available?'],
    meta: { category: primaryCategory, location: describeLocation(intent.location) },
  };
}

function buildFollowUps(intent) {
  const cat = intent.categories[0];
  if (!cat) return ['What tourism information is available?'];
  const prompts = categoryBySlug[cat].aiPrompts.filter(
    (p) => normalize(p) !== normalize(intent.rest),
  );
  return prompts.slice(0, 2);
}
