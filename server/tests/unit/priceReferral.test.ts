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

describe('answer validation and source links', () => {
  it('accepts links to a source’s own page but still rejects invented links', async () => {
    const { validateModelAnswer } = await import('../../src/rag/answerValidation.js');
    const sources = [{ id: 'S1', type: 'document', title: 'Business name registration', text: 'Filing fee BDS $104.00.', url: 'https://caipo.gov.bb/corporate-affairs/business-name-registration' }];
    const answer = (text: string) => ({ answer: text, source_ids: ['S1'], needs_clarification: false, clarification_question: '' });
    expect(validateModelAnswer(answer('Details: https://caipo.gov.bb/corporate-affairs/business-name-registration/.'), sources).ok).toBe(true);
    expect(validateModelAnswer(answer('Details: https://caipo.gov.bb/made-up-page'), sources).ok).toBe(false);
  });
});
