import { daysAgo } from './helpers';

/**
 * DEMO chatbot conversations. Transcripts, sources and retrieval diagnostics are illustrative;
 * the production RAG service does not exist yet. Only user-safe metadata is shown — no hidden
 * model reasoning.
 */
const src = (type, id, title, snippet, meta = '') => ({ type, id, title, snippet, meta });

function convo(id, startDays, hour, topic, status, feedback, messages, extra = {}) {
  const start = new Date(daysAgo(startDays, hour, extra.minute ?? 5));
  const timed = messages.map((m, i) => ({
    id: `${id}-m${i + 1}`,
    ...m,
    at: new Date(start.getTime() + i * 45_000).toISOString(),
  }));
  return {
    id,
    startedAt: timed[0].at,
    endedAt: timed.at(-1).at,
    messageCount: timed.length,
    topic,
    relatedCategoryId: extra.categoryId ?? null,
    relatedListingId: extra.listingId ?? null,
    status,
    feedback, // 'positive' | 'negative' | null
    reviewStatus: extra.reviewStatus ?? 'unreviewed',
    notes: extra.notes ?? [],
    retrieval: {
      documentsSearched: extra.searched ?? 24,
      sourcesUsed: timed.flatMap((m) => m.sources ?? []).length,
      latencyMs: extra.latency ?? 1450,
    },
    messages: timed,
  };
}

const U = (text) => ({ role: 'user', text });
const A = (text, sources = [], opts = {}) => ({ role: 'assistant', text, sources, ...opts });

export const mockConversations = [
  convo(
    'conv-2318',
    0,
    9,
    'Restaurants',
    'answered',
    'positive',
    [
      U('Any good restaurants near Holetown?'),
      A(
        'I found 2 restaurant listings in the Holetown area: **Saltwind Beach Kitchen** (beachfront seafood) and a Caribbean dining listing. I don’t have live opening hours for today.',
        [
          src(
            'listing',
            'lst-001',
            'Saltwind Beach Kitchen',
            'Beachfront seafood with west coast sunsets.',
            'Restaurants · Paynes Bay',
          ),
        ],
        { listingIds: ['lst-001'] },
      ),
      U('Is Saltwind on the beach?'),
      A('Yes — the listing describes it as beachfront, with tables on the sand.', [
        src(
          'listing',
          'lst-001',
          'Saltwind Beach Kitchen',
          'Amenities: Beachfront, Outdoor seating…',
          'Restaurants',
        ),
      ]),
    ],
    { categoryId: 'cat-restaurants', listingId: 'lst-001', latency: 1210 },
  ),
  convo(
    'conv-2317',
    0,
    8,
    'Accommodation',
    'answered',
    null,
    [
      U('Show me guesthouses in Christ Church'),
      A(
        'Here is a guesthouse listed in Christ Church: **Coral Cove Guesthouse** in Hastings.',
        [
          src(
            'listing',
            'lst-002',
            'Coral Cove Guesthouse',
            'Family-run guesthouse steps from the boardwalk.',
            'Guesthouses · Hastings',
          ),
        ],
        { listingIds: ['lst-002'] },
      ),
    ],
    { categoryId: 'cat-guesthouses', listingId: 'lst-002', latency: 980 },
  ),
  convo(
    'conv-2316',
    1,
    16,
    'Tours',
    'answered',
    'positive',
    [
      U('Which businesses offer snorkeling tours?'),
      A(
        'Two listings offer snorkelling: **Turquoise Tide Catamaran Cruises** and **Reef & Turtle Snorkel Co.** Check gear and inclusions with each operator.',
        [
          src(
            'listing',
            'lst-003',
            'Turquoise Tide Catamaran Cruises',
            'Snorkel stops and lunch on board.',
            'Tours · Carlisle Bay',
          ),
          src(
            'listing',
            'lst-010',
            'Reef & Turtle Snorkel Co.',
            'Small-group snorkelling.',
            'Tours · Holetown',
          ),
          src(
            'faq',
            'faq-007',
            'Do catamaran cruises include snorkel gear?',
            'Many operators include gear, but it varies.',
            'FAQ',
          ),
        ],
        { listingIds: ['lst-003', 'lst-010'] },
      ),
    ],
    { categoryId: 'cat-tours', reviewStatus: 'reviewed', latency: 1620 },
  ),
  convo(
    'conv-2315',
    1,
    11,
    'Opening hours',
    'fallback',
    'negative',
    [
      U('Is Catch Corner open tonight?'),
      A(
        'I don’t have opening hours for Catch Corner Fish Shack, so I can’t confirm whether it’s open tonight. Contacting the business directly is the best option.',
        [
          src(
            'listing',
            'lst-008',
            'Catch Corner Fish Shack',
            'No opening hours supplied.',
            'Restaurants · Oistins',
          ),
        ],
        { fallback: true },
      ),
    ],
    {
      categoryId: 'cat-restaurants',
      listingId: 'lst-008',
      reviewStatus: 'flagged',
      notes: [
        {
          id: 'n1',
          author: 'Jamal Small',
          text: 'Ask the owner to add opening hours — frequent question.',
          at: daysAgo(1, 13),
        },
      ],
    },
  ),
  convo(
    'conv-2314',
    2,
    14,
    'Transport',
    'answered',
    'positive',
    [
      U('How do I get from the airport to Hastings?'),
      A(
        'Taxis and private transfers are common. **Island Hop Taxi Service** lists airport transfers. Agree the fare before you set off.',
        [
          src(
            'listing',
            'lst-005',
            'Island Hop Taxi Service',
            'Airport transfers across the island.',
            'Transportation · Bridgetown',
          ),
          src(
            'guide',
            'doc-004',
            'Getting around Barbados',
            'Agree the fare before you set off.',
            'Tourism guide',
          ),
        ],
        { listingIds: ['lst-005'] },
      ),
    ],
    { categoryId: 'cat-transport' },
  ),
  convo(
    'conv-2313',
    2,
    10,
    'Weather',
    'fallback',
    null,
    [
      U('What will the weather be like tomorrow?'),
      A(
        'I don’t have live information such as weather forecasts. I can help you find businesses and travel information in the AI Bajan directory.',
        [],
        { fallback: true },
      ),
    ],
    { searched: 0, latency: 420 },
  ),
  convo(
    'conv-2312',
    3,
    19,
    'Food',
    'answered',
    'positive',
    [
      U('What is the national dish?'),
      A('Cou-cou and flying fish is the national dish of Barbados.', [
        src(
          'guide',
          'doc-003',
          'Where to experience local Bajan food',
          'Cou-cou and flying fish is the national dish of Barbados.',
          'Tourism guide',
        ),
      ]),
      U('Where can I try fish cakes?'),
      A(
        'Fish cakes are a common snack across the island. In the directory, **Catch Corner Fish Shack** in Oistins serves local fish dishes.',
        [
          src(
            'listing',
            'lst-008',
            'Catch Corner Fish Shack',
            'Casual fried and grilled fish.',
            'Restaurants · Oistins',
          ),
        ],
        { listingIds: ['lst-008'] },
      ),
    ],
    { categoryId: 'cat-restaurants' },
  ),
  convo(
    'conv-2311',
    3,
    12,
    'Beaches',
    'partial',
    'negative',
    [
      U('Can I swim at Bathsheba with kids?'),
      A(
        'Bathsheba has powerful surf and strong currents, and many spots are not suitable for swimming. For calmer water, the west coast is generally more sheltered.',
        [
          src(
            'faq',
            'faq-006',
            'Is it safe to swim at Bathsheba?',
            'Strong currents. Follow local advice.',
            'FAQ',
          ),
        ],
      ),
      U('Which west coast beach exactly?'),
      A('I don’t have beach-by-beach conditions in the directory. Check locally on the day.', [], {
        fallback: true,
      }),
    ],
    {
      categoryId: 'cat-beaches',
      notes: [
        {
          id: 'n2',
          author: 'Rhea Phillips',
          text: 'Candidate for a new knowledge article on calm-water beaches.',
          at: daysAgo(2, 9),
        },
      ],
    },
  ),
  convo(
    'conv-2310',
    4,
    15,
    'Shopping',
    'answered',
    'positive',
    [
      U('Where can I buy local crafts in Bridgetown?'),
      A(
        '**Pelican Craft Collective** in Bridgetown sells handmade gifts from island artisans.',
        [
          src(
            'listing',
            'lst-004',
            'Pelican Craft Collective',
            'Handmade gifts from island artisans.',
            'Shopping · Bridgetown',
          ),
        ],
        { listingIds: ['lst-004'] },
      ),
    ],
    { categoryId: 'cat-shopping', listingId: 'lst-004', reviewStatus: 'reviewed' },
  ),
  convo(
    'conv-2309',
    5,
    9,
    'Wellness',
    'answered',
    null,
    [
      U('Any spas on the west coast?'),
      A(
        '**Seabreeze Day Spa** in Holetown offers massage and treatments in an open-air pavilion.',
        [
          src(
            'listing',
            'lst-006',
            'Seabreeze Day Spa',
            'Open-air treatment rooms.',
            'Health and Wellness · Holetown',
          ),
        ],
        { listingIds: ['lst-006'] },
      ),
    ],
    { categoryId: 'cat-wellness' },
  ),
  convo(
    'conv-2308',
    6,
    20,
    'Prices',
    'fallback',
    'negative',
    [
      U('How much is a catamaran cruise?'),
      A(
        'I don’t have current prices. Please check directly with operators such as Turquoise Tide Catamaran Cruises.',
        [src('listing', 'lst-003', 'Turquoise Tide Catamaran Cruises', 'Price range: $$$', 'Tours')],
        { fallback: true },
      ),
    ],
    { categoryId: 'cat-tours' },
  ),
  convo(
    'conv-2307',
    6,
    13,
    'Out of scope',
    'error',
    null,
    [
      U('Write me a poem about my ex'),
      A(
        'Sorry — something went wrong while answering. (Sample error state: the assistant only answers Barbados travel and directory questions.)',
        [],
        { fallback: true, error: true },
      ),
    ],
    { searched: 0, latency: 3900 },
  ),
  convo(
    'conv-2306',
    8,
    11,
    'Culture',
    'answered',
    'positive',
    [
      U('Is there a walking tour of historic Bridgetown?'),
      A(
        'Yes — **Heritage Streets Walking Tours** runs guided walks through historic Bridgetown, part of the UNESCO-listed Historic Bridgetown and its Garrison.',
        [
          src(
            'listing',
            'lst-012',
            'Heritage Streets Walking Tours',
            'Guided walks through historic Bridgetown.',
            'Local Experiences · Bridgetown',
          ),
        ],
        { listingIds: ['lst-012'] },
      ),
    ],
    { categoryId: 'cat-experiences', reviewStatus: 'reviewed' },
  ),
  convo(
    'conv-2305',
    10,
    17,
    'Car hire',
    'answered',
    null,
    [
      U('car rental holetown'),
      A(
        '**Leeward Car Rentals** in Holetown offers compact cars and open-top runabouts. Barbados drives on the left.',
        [
          src(
            'listing',
            'lst-024',
            'Leeward Car Rentals',
            'Compact cars and open-top runabouts.',
            'Transportation · Holetown',
          ),
          src(
            'faq',
            'faq-008',
            'Which side of the road do people drive on?',
            'Barbados drives on the left.',
            'FAQ',
          ),
        ],
        { listingIds: ['lst-024'] },
      ),
    ],
    { categoryId: 'cat-transport' },
  ),
];
