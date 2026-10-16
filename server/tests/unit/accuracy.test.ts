import { describe, expect, it } from 'vitest';
import { validateModelAnswer } from '../../src/rag/answerValidation.js';
import { betterTitle, isNewsPage, newsDate, repairMojibake } from '../../src/knowledge/pageCleanup.js';

const sources = [{ id: 'S1', type: 'document', title: 'Water Authority', text: 'Call the Barbados Water Authority on (246) 434-4200.', url: 'https://bwa.gov.bb/contact' }];
const answer = (text: string) => ({ answer: text, source_ids: ['S1'], needs_clarification: false, clarification_question: '' });

describe('answer validation', () => {
  it('does not mistake dates and year ranges for phone numbers', () => {
    expect(validateModelAnswer(answer('Dame Sandra Mason served 2021-2025; today is 2026-10-16. Call 434-4200.'), sources).ok).toBe(true);
  });
  it('lists each unsupported detail so it can be rewritten or removed', () => {
    const v = validateModelAnswer(answer('Call 434-4200 or 555-0199, or see https://example.com/made-up.'), sources);
    expect(v.ok).toBe(false);
    expect(v.unsupported).toEqual(['555-0199', 'https://example.com/made-up']);
    expect(v.draft).toContain('434-4200');
  });
});

describe('imported page clean-up', () => {
  it('repairs mis-decoded characters and leaves correct text alone', () => {
    expect(repairMojibake('the countryâ€™s â€œbestâ€\u009d cafÃ©')).toBe('the country’s “best” café');
    expect(repairMojibake('Bajan’s “fish cakes” — café')).toBe('Bajan’s “fish cakes” — café');
  });
  it('replaces site-wide titles with the page’s own heading', () => {
    expect(betterTitle('GOV.BB', '### Apply for a Passport\n###\n- Home', { url: 'https://www.gov.bb/Citizens/apply-passport' })).toBe('Apply for a Passport');
    expect(betterTitle('Business Barbados', '## Incorporation\n## Revival of Societies\ntext', { siteTitles: new Set(['business barbados']), url: 'https://caipo.gov.bb/corporate-affairs/revival-societies' })).toBe('Revival of Societies');
    expect(betterTitle('Facebook-color', '# Barbados Tsunami Alerts\ntext')).toBe('Barbados Tsunami Alerts');
    expect(betterTitle('Driver Licence | Barbados Licensing Authority', 'x')).toBe('Driver Licence | Barbados Licensing Authority');
  });
  it('recognises news items and their publication date', () => {
    const news = '### News Article\nNewly Designed Barbados Passport Now Available\nBy GOV.BB\non 5 Apr 2023, 9:04AM\nBarbadians started';
    expect(isNewsPage('https://www.gov.bb/news_article.php?id=150', '', news)).toBe(true);
    expect(isNewsPage('https://www.gov.bb/Citizens/apply-passport', 'Apply for a Passport', 'How to apply')).toBe(false);
    expect(newsDate(news)).toBe('2023-04-05');
    expect(betterTitle('GOV.BB', news, { url: 'https://www.gov.bb/news_article.php?id=150' })).toBe('Newly Designed Barbados Passport Now Available');
  });
});

describe('answers when nothing is listed', () => {
  it('points rental, job and second-hand questions to Jobs & Classifieds instead of asking about a shop', async () => {
    const { noEvidenceAnswer } = await import('../../src/rag/generator.js');
    const { analyzeQuery } = await import('../../src/rag/queryAnalysis.js');
    const { testLexicon } = await import('../fixtures/lexicon.js');
    const text = noEvidenceAnswer(analyzeQuery('Where can I find a reasonably priced apartment to rent in St. Philip?', testLexicon)).text;
    expect(text).toMatch(/Jobs & Classifieds/);
    expect(text).not.toMatch(/type of shop/);
    // A shop question keeps the shop wording.
    expect(noEvidenceAnswer(analyzeQuery('Where can I buy glucose test strips?', testLexicon)).text).not.toMatch(/Jobs & Classifieds/);
  });
});
