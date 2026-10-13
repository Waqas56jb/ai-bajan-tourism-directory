import { describe, expect, it } from 'vitest';
import { mockBusinesses } from '@/data/mockBusinesses';
import { generateMockReply } from './mockChatEngine';

const ask = (message, context) => generateMockReply({ message, context }, mockBusinesses);
const bySlug = Object.fromEntries(mockBusinesses.map((b) => [b.slug, b]));
const full = (res) => res.businesses.map((s) => bySlug[s.slug]);

describe('demo chat adapter relevance', () => {
  it('finds only restaurants in Holetown', () => {
    const res = ask('Find restaurants near Holetown.');
    expect(res.businesses.length).toBeGreaterThan(0);
    for (const b of full(res)) {
      expect(b.categories).toContain('restaurants');
      expect(b.area).toBe('Holetown');
    }
    expect(res.businesses.map((b) => b.slug)).not.toContain('holetown-linen-resortwear');
  });

  it('finds guesthouses in Christ Church only', () => {
    const res = ask('Show guesthouses in Christ Church.');
    const results = full(res);
    expect(results.length).toBeGreaterThan(0);
    for (const b of results) {
      expect(b.parish).toBe('Christ Church');
      expect(b.businessType).toBe('Guesthouse');
    }
  });

  it('finds snorkelling tours and excludes unrelated tours', () => {
    const res = ask('Which businesses offer snorkeling tours?');
    const slugs = res.businesses.map((b) => b.slug);
    expect(slugs).toEqual(
      expect.arrayContaining(['turquoise-tide-catamaran', 'reef-and-turtle-snorkel']),
    );
    expect(slugs).not.toContain('atlantic-swell-surf-school');
    expect(slugs).not.toContain('northern-trails-hiking');
  });

  it('finds local shops in Bridgetown', () => {
    const res = ask('Explore local shops in Bridgetown.');
    for (const b of full(res)) {
      expect(b.category).toBe('shopping');
      expect(b.area).toBe('Bridgetown');
    }
  });

  it('respects amenity constraints', () => {
    const res = ask('What family-friendly activities are listed?');
    expect(res.businesses.length).toBeGreaterThan(0);
    for (const b of full(res)) {
      expect(b.amenities).toContain('family-friendly');
      expect(b.categories).toContain('tours');
    }
  });

  it('explains when nothing matches instead of inventing results', () => {
    const res = ask('Find spas in Oistins');
    expect(res.reply).toMatch(/couldn’t find/i);
    // Fallback, if any, is explicitly labelled and limited to the same parish and category
    for (const b of full(res)) {
      expect(b.parish).toBe('Christ Church');
      expect(b.category).toBe('wellness');
    }
    expect(res.reply).toMatch(/same parish/i);
  });

  it('returns no businesses for a location with no matching category and no parish fallback', () => {
    const res = ask('Show car rental in Bathsheba');
    expect(res.businesses).toEqual([]);
    expect(res.reply).toMatch(/couldn’t find/i);
  });

  it('is honest about live information', () => {
    const res = ask('What is the weather like today?');
    expect(res.businesses).toEqual([]);
    expect(res.reply).toMatch(/don’t have live information/i);
  });

  it('gives an overview for general questions', () => {
    const res = ask('What tourism information is available?');
    expect(res.reply).toMatch(/Restaurants & Dining/);
  });

  it('answers about a business in context using only its data', () => {
    const res = ask('What are the opening hours?', { businessSlug: 'sample-holetown-restaurant' });
    expect(res.reply).toMatch(/Tuesday – Sunday/);
    const none = ask('What are the opening hours?', { businessSlug: 'saltwind-beach-kitchen' });
    expect(none.reply).toMatch(/doesn’t include opening hours/);
  });

  it('only returns valid internal source links', () => {
    const res = ask('Find restaurants in Christ Church');
    for (const s of res.sources) expect(s.url.startsWith('/')).toBe(true);
  });
});
