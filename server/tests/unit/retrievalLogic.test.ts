import { describe, expect, it } from 'vitest';
import { assessEvidence } from '../../src/rag/evidence.js';
import { extractiveAnswer, noEvidenceAnswer } from '../../src/rag/generator.js';
import { analyzeQuery } from '../../src/rag/queryAnalysis.js';
import { buildTsQuery } from '../../src/rag/queryBuilder.js';
import { fuse, textHasTerm, type ChunkHit, type RetrievalResult } from '../../src/rag/retrieval.js';
import { IDS, testLexicon } from '../fixtures/lexicon.js';

const hit = (o: Partial<ChunkHit> & { source_id: string; chunk_text: string }): ChunkHit => ({
  chunk_id: `${o.source_id}-${o.chunk_kind ?? 'listing_profile'}`,
  source_type: 'listing',
  source_version: 1,
  chunk_kind: 'listing_profile',
  title: o.source_id,
  metadata: { area: 'Bridgetown, St. Michael', url: `/listings/${o.source_id}` },
  category_ids: [],
  location_ids: [],
  ...o,
});

const pharmacyA = hit({
  source_id: 'harbour',
  title: 'Harbour Lights Pharmacy',
  chunk_text: 'Harbour Lights Pharmacy — Pharmacies — Bridgetown\nCommunity pharmacy with diabetic supplies including blood glucose test strips.',
  category_ids: [IDS.catPharmacies],
  location_ids: [IDS.locBridgetown, IDS.locStMichael, IDS.locBarbados],
});
const pharmacyB = hit({
  source_id: 'westside',
  title: 'Westside Chemist',
  chunk_text: 'Westside Chemist — Pharmacies — Holetown\nFriendly chemist for prescriptions and travel essentials.\nPhone: +1 246-555-0142',
  chunk_kind: 'listing_details',
  category_ids: [IDS.catPharmacies],
  location_ids: [IDS.locHoletown, IDS.locStJames, IDS.locBarbados],
});
const hotel = hit({ source_id: 'coral', title: 'Coral Reef Hotel', chunk_text: 'Coral Reef Hotel — Hotels\nBeachfront hotel with a swimming pool.', category_ids: [IDS.catHotels] });

const result = (lists: Record<string, ChunkHit[]>, failed = false, errors: RetrievalResult['errors'] = []): RetrievalResult => {
  const a = analyzeQuery('x', testLexicon);
  return { candidates: fuse(a, new Map(Object.entries(lists)), 1, 1, 0.25), methods: Object.keys(lists), errors, failed, timings: {}, tsquery: null, refinementUsed: false };
};

describe('query construction', () => {
  it('sanitises tsquery syntax from user input', () => {
    const q = buildTsQuery(["pharmacy'); drop table x; --", 'a&b|c!d:*'], ['test strips'])!;
    expect(q).toMatch(/^[a-z0-9 |()<>-]+$/);
    expect(q).not.toMatch(/drop table/);
  });
  it('returns null when nothing meaningful remains', () => {
    expect(buildTsQuery(['!!', '?'])).toBeNull();
  });
});

describe('term matching', () => {
  it('matches singular/plural forms on word boundaries', () => {
    expect(textHasTerm('A friendly pharmacy', 'pharmacies')).toBe(true);
    expect(textHasTerm('glucose test strips in stock', 'test strip')).toBe(true);
    expect(textHasTerm('pharmacist on duty', 'pharmacy')).toBe(false);
  });
});

describe('fusion and evidence for the client question', () => {
  const a = analyzeQuery('How do I find pharmacies to sell test strips to?', testLexicon);
  const fused = (lists: Record<string, ChunkHit[]>) => fuse(a, new Map(Object.entries(lists)), 1, 1, 0.25);

  it('ranks the pharmacy that mentions test strips first and keeps the other pharmacy', () => {
    const c = fused({ structured: [pharmacyB, pharmacyA], keyword: [pharmacyA, hotel] });
    expect(c[0].sourceId).toBe('harbour');
    expect(c[0].productMatch).toBe(true);
    expect(c.map((x) => x.sourceId)).toContain('westside');
  });

  it('produces a strong, caveated answer listing pharmacies — never "insufficient"', () => {
    const r: RetrievalResult = { ...result({}), candidates: fused({ structured: [pharmacyB, pharmacyA], keyword: [pharmacyA] }) };
    const ev = assessEvidence(a, r, { unresolved: null }, 8);
    expect(ev.level).toBe('strong');
    expect(ev.listings.map((l) => l.sourceId)).toEqual(['harbour', 'westside']);
    expect(ev.caveats).toContain('purchase_interest_not_verified');
    const ans = extractiveAnswer(a, ev);
    expect(ans.text).toContain('Harbour Lights Pharmacy');
    expect(ans.text).toContain('Westside Chemist');
    expect(ans.text).toMatch(/doesn’t say whether they buy test strips/);
    expect(ans.text.toLowerCase()).not.toContain('insufficient');
    expect(ans.sources.map((s) => s.id)).toEqual(['harbour', 'westside']);
  });

  it('distinguishes a technical failure from "no evidence"', () => {
    const failed = result({}, true, [{ method: 'keyword', kind: 'ECONNREFUSED' }]);
    expect(assessEvidence(a, failed, { unresolved: null }, 8).level).toBe('failure');
    const empty = result({ structured: [], keyword: [] });
    expect(assessEvidence(a, empty, { unresolved: null }, 8).level).toBe('none');
  });

  it('partial retrieval failure is flagged as degraded but still answers', () => {
    const r = { ...result({}, false, [{ method: 'vector', kind: 'timeout' }]), candidates: fused({ structured: [pharmacyA] }) };
    const ev = assessEvidence(a, r, { unresolved: null }, 8);
    expect(ev.level).toBe('strong');
    expect(ev.caveats).toContain('degraded_retrieval');
  });

  it('unresolved "this business" asks for clarification', () => {
    const q = analyzeQuery('What is the opening time of this specific listed business?', testLexicon);
    const ev = assessEvidence(q, result({}), { unresolved: 'listing_reference' }, 8);
    expect(ev.level).toBe('ambiguous');
    expect(ev.clarification).toMatch(/Which business/);
  });

  it('a refinement nobody matches is reported, not hidden', () => {
    const q = { ...analyzeQuery('hotels', testLexicon), productTerms: ['vegetarian'] };
    const r = { ...result({}), candidates: fuse(q, new Map([['structured', [hotel]]]), 1, 1, 0.25) };
    const ev = assessEvidence(q, r, { unresolved: null }, 8);
    expect(ev.level).toBe('partial');
    expect(ev.caveats).toContain('refinement_not_matched');
  });

  it('vector hits under the similarity floor are ignored', () => {
    const q = analyzeQuery('volcano tours', testLexicon);
    const c = fuse(q, new Map([['vector', [{ ...hotel, similarity: 0.1 }]]]), 1, 1, 0.25);
    expect(c).toEqual([]);
  });

  it('no-evidence messages are specific and honest', () => {
    const q = analyzeQuery('Who could buy test strips from me?', testLexicon);
    const ans = noEvidenceAnswer(q);
    expect(ans.status).toBe('no_evidence');
    expect(ans.text).toMatch(/doesn’t have information about who buys test strips/);
    expect(ans.sources).toEqual([]);
  });
});
