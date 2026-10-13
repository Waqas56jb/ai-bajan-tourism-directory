/**
 * Dashboard aggregates. Counts (listings, documents, placements) come from the demo
 * collections; traffic and chatbot figures come from the SAMPLE series in mockDashboard.js.
 * None of it is real analytics.
 */
import { db } from './db';
import { simulate } from './mockApi';
import { dailySeries, categoryVisits } from '@/data/mockDashboard';

const sum = (rows, key) => rows.reduce((acc, r) => acc + r[key], 0);

/** Group a daily series into weekly buckets when the window is long. */
function bucket(rows, days) {
  if (days <= 31) return rows;
  const out = [];
  for (let i = 0; i < rows.length; i += 7) {
    const slice = rows.slice(i, i + 7);
    out.push(
      Object.keys(slice[0]).reduce((acc, k) => {
        acc[k] = k === 'date' ? slice[0].date : sum(slice, k);
        return acc;
      }, {}),
    );
  }
  return out;
}

export const getDashboardStats = ({ days = 30 } = {}) =>
  simulate(() => {
    const listings = db.listings.all();
    const documents = db.documents.all();
    const featured = db.featured.all();
    const categories = db.categories.all();

    const window = dailySeries.slice(-days);
    const previous = dailySeries.slice(-days * 2, -days);
    const hasPrevious = previous.length === days;

    const DAY = 86_400_000;
    const now = Date.now();
    const createdBetween = (fromDaysAgo, toDaysAgo) =>
      listings.filter((l) => {
        const t = new Date(l.createdAt).getTime();
        return t > now - fromDaysAgo * DAY && t <= now - toDaysAgo * DAY;
      }).length;
    const created = createdBetween(days, 0);
    const createdPrev = createdBetween(days * 2, days);
    const conversations = sum(window, 'conversations');
    const conversationsPrev = hasPrevious ? sum(previous, 'conversations') : null;

    const byStatus = (s) => listings.filter((l) => l.status === s).length;

    // Listing growth from the listings' own creation dates (cumulative total per bucket).
    const step = days <= 31 ? 1 : 7;
    const growth = [];
    for (let back = days - 1; back >= 0; back -= step) {
      const end = now - Math.max(0, back - step + 1) * DAY;
      const start = end - step * DAY;
      growth.push({
        date: new Date(now - back * DAY).toISOString(),
        total: listings.filter((l) => new Date(l.createdAt).getTime() <= end).length,
        created: listings.filter((l) => {
          const t = new Date(l.createdAt).getTime();
          return t > start && t <= end;
        }).length,
      });
    }

    const listingCounts = Object.fromEntries(
      categories.map((c) => [c.id, listings.filter((l) => l.categoryId === c.id).length]),
    );

    return {
      range: { days },
      kpis: {
        totalListings: { value: listings.length, created, createdPrev },
        publishedListings: {
          value: byStatus('published'),
          share: listings.length ? byStatus('published') / listings.length : 0,
        },
        pendingApprovals: { value: byStatus('pending') },
        conversations: { value: conversations, previous: conversationsPrev },
        knowledgeDocuments: {
          value: documents.length,
          indexed: documents.filter((d) => d.indexingStatus === 'indexed').length,
        },
        activeFeatured: {
          value: featured.filter((f) => f.status === 'active').length,
          scheduled: featured.filter((f) => f.status === 'scheduled').length,
        },
      },
      listingGrowth: growth,
      chatbotActivity: bucket(window, days).map((d) => ({
        date: d.date,
        conversations: d.conversations,
        fallback: d.fallback,
      })),
      distribution: ['published', 'pending', 'draft', 'rejected', 'archived'].map((s) => ({
        status: s,
        value: byStatus(s),
      })),
      popularCategories: categories
        .filter((c) => c.active)
        .map((c) => ({
          id: c.id,
          name: c.name,
          listings: listingCounts[c.id],
          visits: Math.round(((categoryVisits[c.id] ?? 0) * days) / 180),
        }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 6),
      recentActivity: [...db.activity.all()].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 7),
      topListings: listings
        .filter((l) => l.status === 'published')
        .sort((a, b) => b.views - a.views)
        .slice(0, 6),
      chatbot: {
        conversations,
        questions: sum(window, 'questions'),
        answered: sum(window, 'answered'),
        fallback: sum(window, 'fallback'),
        positive: sum(window, 'positive'),
        negative: sum(window, 'negative'),
        latencyMs: window.length ? Math.round(sum(window, 'latencyMs') / window.length) : 0,
      },
      generatedAt: new Date().toISOString(),
    };
  });
