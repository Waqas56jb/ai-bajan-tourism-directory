import { describe, expect, it } from 'vitest';
import { isShoppingPriceQuestion, priceReferral } from '../../src/rag/priceReferral.js';
import { analyzeQuery } from '../../src/rag/queryAnalysis.js';
import { testLexicon } from '../fixtures/lexicon.js';

describe('AskDealia price referral', () => {
  it('recognises supermarket price questions only', () => {
    for (const q of ['Where is rice cheapest in Barbados?', 'What are this week’s supermarket specials?', 'How much does a bag of flour cost?', 'Compare prices for salt fish']) {
      expect(isShoppingPriceQuestion(q)).toBe(true);
    }
    for (const q of ['How much is the bus fare?', 'What does a passport cost?', 'Where can I rent a cheap apartment?', 'What is cou-cou?']) {
      expect(isShoppingPriceQuestion(q)).toBe(false);
    }
  });

  it('links to AskDealia results for the product, as an official source', () => {
    const r = priceReferral(analyzeQuery('Where is salt fish cheapest in Barbados?', testLexicon));
    expect(r).toMatchObject({ tier: 'official', url: 'https://askdealia.gov.bb/search/salt%20fish' });
    expect(priceReferral(analyzeQuery('What are this week’s supermarket specials?', testLexicon))?.url).toBe('https://askdealia.gov.bb');
    expect(priceReferral(analyzeQuery('How do I renew my passport?', testLexicon))).toBeNull();
  });
});
