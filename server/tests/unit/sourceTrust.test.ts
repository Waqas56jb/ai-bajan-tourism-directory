import { describe, expect, it } from 'vitest';
import { analyzeQuery } from '../../src/rag/queryAnalysis.js';
import { fuse, type ChunkHit } from '../../src/rag/retrieval.js';
import { needsAuthoritativeSource, trustTier, trustWeight } from '../../src/rag/sourceTrust.js';
import { pageUpdatedDate } from '../../src/knowledge/urlImport.js';
import { testLexicon } from '../fixtures/lexicon.js';

const doc = (id: string, url: string | null, text: string): ChunkHit => ({
  chunk_id: `${id}-1`,
  source_id: id,
  source_type: 'document',
  source_version: 1,
  chunk_kind: 'document_section',
  title: id,
  chunk_text: text,
  metadata: url ? { sourceUrl: url } : {},
  category_ids: [],
  location_ids: [],
});

describe('Trusted Information Network tiers', () => {
  it('classifies sources by website', () => {
    expect(trustTier('document', { sourceUrl: 'https://alpha.gov.bb/services/passport' })).toBe('official');
    expect(trustTier('document', { sourceUrl: 'https://www.transportboard.com/routes' })).toBe('official');
    expect(trustTier('document', { sourceUrl: 'https://www.visitbarbados.org/barbados-street-food' })).toBe('institutional');
    expect(trustTier('document', { sourceUrl: 'https://www.cavehill.uwi.edu/fees' })).toBe('institutional');
    expect(trustTier('document', { sourceUrl: 'https://barbados.org/food.htm' })).toBe('publication');
    expect(trustTier('document', { sourceUrl: 'https://en.wikipedia.org/wiki/Barbados' })).toBe('background');
    expect(trustTier('listing', { url: '/listings/x' })).toBe('local');
    expect(trustTier('document', {})).toBe('local');
  });

  it('treats fees, laws, licences, schedules and current information as needing authority', () => {
    for (const q of ['How much is the passport fee?', 'Which bus goes to Bathsheba?', 'Do I need a licence to sell food?', 'Is there a hurricane warning today?']) {
      expect(needsAuthoritativeSource(q)).toBe(true);
    }
    expect(needsAuthoritativeSource('What is cou-cou?')).toBe(false);
    expect(trustWeight('background', true)).toBeLessThan(trustWeight('background', false));
    expect(trustWeight('official', true)).toBeGreaterThan(trustWeight('institutional', true));
  });

  it('ranks an official page above Wikipedia when both match equally', () => {
    const a = analyzeQuery('How do I renew a driver licence?', testLexicon);
    const wiki = doc('wiki', 'https://en.wikipedia.org/wiki/Driving_licence', 'To renew a driver licence most countries ask for the current licence, a photo and a fee.');
    const gov = doc('gov', 'https://www.gov.bb/Citizens/driver-licence', 'Renew a driver licence: bring your current licence, a photo and pay the fee at the Licensing Authority.');
    // Wikipedia is ranked first by both search methods, yet the official page still wins.
    const out = fuse(a, new Map([['keyword', [wiki, gov]], ['vector', [{ ...wiki, similarity: 0.8 }, { ...gov, similarity: 0.79 }]]]), 1, 1, 0.25);
    expect(out[0].sourceId).toBe('gov');
    expect(out.find((c) => c.sourceId === 'wiki')?.tier).toBe('background');
  });
});

describe('page update dates', () => {
  it('reads the page’s own modified date before the HTTP header', () => {
    expect(pageUpdatedDate('<meta property="article:modified_time" content="2025-03-14T10:00:00+00:00">', 'Wed, 01 Oct 2026 00:00:00 GMT')).toBe('2025-03-14');
    expect(pageUpdatedDate('<script type="application/ld+json">{"dateModified":"2024-11-02"}</script>')).toBe('2024-11-02');
    expect(pageUpdatedDate('<p>Last updated: 5th June 2025</p>')).toBe('2025-06-05');
    expect(pageUpdatedDate('<p>Nothing here</p>', 'Tue, 07 Jan 2025 08:00:00 GMT')).toBe('2025-01-07');
    expect(pageUpdatedDate('<p>Nothing here</p>')).toBeNull();
    expect(pageUpdatedDate('<meta property="article:modified_time" content="2999-01-01">')).toBeNull();
  });
});
