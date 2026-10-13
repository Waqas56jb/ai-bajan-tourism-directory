import { describe, expect, it } from 'vitest';
import { mockBusinesses } from '@/data/mockBusinesses';
import {
  searchDirectory,
  findRelated,
  interpretQuery,
  normalize,
  sortBusinesses,
  paginate,
} from './search';

const all = (filters) => searchDirectory(mockBusinesses, { pageSize: 100, ...filters });
const names = (res) => res.items.map((b) => b.name);

describe('directory search', () => {
  it('returns every published business with no filters', () => {
    expect(all({}).total).toBe(mockBusinesses.length);
  });

  it('matches businesses by name', () => {
    const res = all({ q: 'Saltwind' });
    expect(names(res)).toEqual(['Saltwind Beach Kitchen']);
  });

  it('matches by service keyword without matching unrelated listings', () => {
    const res = all({ q: 'snorkeling' });
    expect(res.total).toBeGreaterThan(0);
    for (const b of res.items) {
      const text = `${b.name} ${b.keywords.join(' ')} ${b.description}`.toLowerCase();
      expect(text).toMatch(/snorkel/);
    }
    expect(names(res)).not.toContain('Atlantic Swell Surf School');
  });

  it('normalises case and whitespace', () => {
    expect(all({ q: '   SALTWIND   beach ' }).total).toBe(1);
    expect(normalize('  Café  &  Co. ')).toBe('cafe and co');
  });

  it('requires every meaningful word to match (no broad-word matches)', () => {
    const res = all({ q: 'seafood oistins' });
    expect(names(res)).toEqual(['Catch Corner Fish Shack']);
  });

  it('filters by category', () => {
    const res = all({ category: 'restaurants' });
    expect(res.total).toBeGreaterThan(0);
    expect(res.items.every((b) => b.categories.includes('restaurants'))).toBe(true);
  });

  it('filters by area', () => {
    const res = all({ location: 'Holetown' });
    expect(res.items.every((b) => b.area === 'Holetown')).toBe(true);
  });

  it('filters by parish', () => {
    const res = all({ location: 'Christ Church' });
    expect(res.total).toBeGreaterThan(0);
    expect(res.items.every((b) => b.parish === 'Christ Church')).toBe(true);
  });

  it('combines category and location filters', () => {
    const res = all({ category: 'restaurants', location: 'Holetown' });
    expect(names(res).sort()).toEqual(['Demo Holetown Restaurant', 'Saltwind Beach Kitchen']);
  });

  it('never returns clothing shops for "restaurants in Holetown" typed as text', () => {
    const res = all({ q: 'restaurants in Holetown' });
    expect(res.interpretedLocation).toBe('Holetown');
    expect(names(res).sort()).toEqual(['Demo Holetown Restaurant', 'Saltwind Beach Kitchen']);
    expect(names(res)).not.toContain('Leeward Linen & Resortwear');
  });

  it('applies amenity and featured filters', () => {
    const res = all({ amenities: ['pool'], featured: true });
    expect(res.items.every((b) => b.amenities.includes('pool') && b.isFeatured)).toBe(true);
  });

  it('returns an empty result rather than unrelated listings', () => {
    const res = all({ category: 'wellness', location: 'Oistins' });
    expect(res.total).toBe(0);
    expect(res.items).toEqual([]);
  });

  it('computes facet counts that ignore their own dimension', () => {
    const res = all({ category: 'restaurants', location: 'Holetown' });
    expect(res.facets.categories.shopping).toBeGreaterThan(0); // other categories in Holetown
    expect(res.facets.locations.Oistins).toBeGreaterThan(0); // restaurants elsewhere
  });

  it('sorts alphabetically both ways and featured first', () => {
    const asc = names(all({ sort: 'name-asc' }));
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));
    const desc = names(all({ sort: 'name-desc' }));
    expect(desc).toEqual([...asc].reverse());
    const featured = all({ sort: 'featured' }).items;
    const firstNonFeatured = featured.findIndex((b) => !b.isFeatured);
    expect(featured.slice(firstNonFeatured).every((b) => !b.isFeatured)).toBe(true);
    expect(sortBusinesses([], 'unknown')).toEqual([]);
  });

  it('paginates and clamps out-of-range pages', () => {
    const p1 = searchDirectory(mockBusinesses, { pageSize: 12, page: 1 });
    const p2 = searchDirectory(mockBusinesses, { pageSize: 12, page: 2 });
    expect(p1.items).toHaveLength(12);
    expect(p1.items[0].id).not.toBe(p2.items[0].id);
    expect(paginate([1, 2, 3], 99, 2)).toMatchObject({ page: 2, pageCount: 2, items: [3] });
  });
});

describe('query interpretation', () => {
  it('extracts locations, categories and amenities', () => {
    const intent = interpretQuery('family-friendly guesthouses in Christ Church');
    expect(intent.location).toEqual({ parish: 'Christ Church' });
    expect(intent.categories).toContain('hotels');
    expect(intent.amenities).toContain('family-friendly');
    expect(intent.keywordTokens).toEqual(['guesthouse']);
  });

  it('prefers the longest location alias', () => {
    expect(interpretQuery('bars in st lawrence gap').location).toEqual({
      area: 'St. Lawrence Gap',
    });
  });
});

describe('related businesses', () => {
  it('prefers the same category and area', () => {
    const base = mockBusinesses.find((b) => b.slug === 'sample-holetown-restaurant');
    const related = findRelated(mockBusinesses, base, 3);
    expect(related[0].slug).toBe('saltwind-beach-kitchen');
    expect(related.every((b) => b.category === 'restaurants' && b.id !== base.id)).toBe(true);
  });
});
