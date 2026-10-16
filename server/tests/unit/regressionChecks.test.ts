import { describe, expect, it } from 'vitest';
import { evaluate } from '../evaluation/runRegression.js';

describe('regression fact checks', () => {
  const checks = { include: [['salt cod', 'salted cod', 'saltfish', 'salt fish']], exclude: ['flying fish'] };
  it('passes an answer with the fact in any accepted wording', () => {
    expect(evaluate('Bajan fish cakes are made with SALTED COD and flour.', checks).pass).toBe(true);
    expect(evaluate('They use saltfish, flour and herbs.', checks).pass).toBe(true);
  });
  it('fails an answer missing the fact or stating a known error', () => {
    expect(evaluate('They are made from fish and flour.', checks)).toMatchObject({ pass: false, missing: [checks.include[0]] });
    expect(evaluate('Made with salt fish and flying fish.', checks)).toMatchObject({ pass: false, found: ['flying fish'] });
  });
});
