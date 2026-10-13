import { daysAgo, seeded, between } from './helpers';

/**
 * DEMO analytics series (180 days). Every number here is SAMPLE data — no analytics are
 * collected yet. Series are seeded so they're stable and internally consistent.
 */
const rand = seeded(2024);

export const dailySeries = Array.from({ length: 180 }, (_, i) => {
  const daysBack = 179 - i;
  const weekday = new Date(daysAgo(daysBack)).getDay();
  const weekend = weekday === 0 || weekday === 6;
  const growth = 1 + i / 260;
  const conversations = Math.round((weekend ? 62 : 44) * growth + between(rand, -8, 12));
  const fallback = Math.round(conversations * (0.09 + rand() * 0.05));
  return {
    date: daysAgo(daysBack),
    listingsCreated: between(rand, 0, 3) + (i % 17 === 0 ? 2 : 0),
    views: Math.round((weekend ? 1650 : 1180) * growth + between(rand, -120, 160)),
    conversations,
    questions: Math.round(conversations * (2.1 + rand() * 0.5)),
    fallback,
    answered: conversations - fallback,
    positive: Math.round(conversations * (0.32 + rand() * 0.06)),
    negative: Math.round(conversations * (0.05 + rand() * 0.03)),
    latencyMs: between(rand, 1100, 1900),
  };
});

export const categoryVisits = {
  'cat-restaurants': 18_420,
  'cat-tours': 15_310,
  'cat-hotels': 12_880,
  'cat-guesthouses': 5_210,
  'cat-beaches': 7_640,
  'cat-attractions': 6_930,
  'cat-transport': 4_120,
  'cat-shopping': 3_870,
  'cat-wellness': 3_150,
  'cat-experiences': 2_940,
  'cat-professional': 0,
};

export const chatTopics = [
  { topic: 'Restaurants', count: 412 },
  { topic: 'Tours', count: 356 },
  { topic: 'Accommodation', count: 301 },
  { topic: 'Transport', count: 214 },
  { topic: 'Beaches', count: 188 },
  { topic: 'Culture', count: 97 },
  { topic: 'Other / out of scope', count: 84 },
];
