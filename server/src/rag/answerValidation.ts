import type { PromptSource } from './prompts.js';

export interface ModelAnswer {
  answer: string;
  source_ids: string[];
  needs_clarification: boolean;
  clarification_question: string;
}

export interface ValidationResult {
  ok: boolean;
  answer: ModelAnswer | null;
  problems: string[];
}

const digits = (s: string) => s.replace(/\D/g, '');

/**
 * Checks a model answer against the sources it was given:
 *  - output must match the schema;
 *  - cited IDs must be among the provided sources (unknown IDs are dropped);
 *  - every phone number, email and URL in the answer must appear in a provided source (its text,
 *    or for URLs, the source's own page address)
 *    (otherwise the answer is rejected as potentially fabricated).
 */
export function validateModelAnswer(raw: unknown, sources: PromptSource[]): ValidationResult {
  const problems: string[] = [];
  const r = raw as Partial<ModelAnswer> | null;
  if (!r || typeof r.answer !== 'string' || !Array.isArray(r.source_ids) || typeof r.needs_clarification !== 'boolean') {
    return { ok: false, answer: null, problems: ['malformed model output'] };
  }
  const answer = r.answer.trim();
  if (!answer) return { ok: false, answer: null, problems: ['empty answer'] };
  if (answer.length > 6000) problems.push('answer too long');

  const known = new Set(sources.map((s) => s.id));
  const cited = [...new Set(r.source_ids.filter((id): id is string => typeof id === 'string' && known.has(id)))];
  if (cited.length !== r.source_ids.length) problems.push('dropped unknown source ids');

  // Source page URLs count as supported: the model is given them and may link to them.
  const corpus = sources.map((s) => `${s.title}\n${s.url ?? ''}\n${s.text}`).join('\n').toLowerCase();
  const corpusDigits = sources.map((s) => digits(s.text));

  const phones = answer.match(/\+?\d[\d ().-]{6,}\d/g) ?? [];
  for (const p of phones) {
    const d = digits(p);
    if (d.length >= 7 && !corpusDigits.some((cd) => cd.includes(d.slice(-7)))) {
      return { ok: false, answer: null, problems: [`unsupported phone number in answer`] };
    }
  }
  const emails = answer.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
  for (const e of emails) if (!corpus.includes(e.toLowerCase())) return { ok: false, answer: null, problems: ['unsupported email in answer'] };
  const urls = answer.match(/https?:\/\/[^\s)>\]]+/g) ?? [];
  for (const u of urls) {
    const clean = u.replace(/[.,;:!?]+$/, '').replace(/\/$/, '').toLowerCase();
    if (!corpus.includes(clean)) return { ok: false, answer: null, problems: ['unsupported URL in answer'] };
  }

  return {
    ok: true,
    answer: {
      answer: answer.slice(0, 6000),
      source_ids: cited,
      needs_clarification: r.needs_clarification,
      clarification_question: typeof r.clarification_question === 'string' ? r.clarification_question.slice(0, 500) : '',
    },
    problems,
  };
}
