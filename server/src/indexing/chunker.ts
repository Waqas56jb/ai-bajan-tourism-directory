import { cleanText } from '../utils/text.js';

export interface Chunk {
  kind: string;
  title: string;
  text: string;
}

export interface ChunkOptions {
  maxChars: number;
  overlapChars: number;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = { maxChars: 1200, overlapChars: 180 };

/** Split into sentences without breaking on common abbreviations or decimals. */
function sentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Pack paragraphs (then sentences) into chunks of at most maxChars. Overlap carries the tail of the
 * previous chunk forward so a fact spanning a boundary is retrievable from either side.
 * `prefix` (e.g. the listing name or "Title › Heading") is prepended to every chunk so each chunk
 * is self-describing for both keyword and semantic search.
 */
export function packText(body: string, prefix: string, opts: ChunkOptions = DEFAULT_CHUNK_OPTIONS): string[] {
  const text = cleanText(body);
  if (!text) return [];
  const budget = Math.max(200, opts.maxChars - prefix.length - 2);
  const units: string[] = [];
  for (const para of text.split(/\n{2,}/)) {
    if (para.length <= budget) units.push(para);
    else {
      let buf = '';
      for (const s of sentences(para)) {
        const piece = s.length > budget ? s.match(new RegExp(`.{1,${budget}}(\\s|$)`, 'g')) ?? [s] : [s];
        for (const p of piece) {
          if ((buf + ' ' + p).trim().length > budget && buf) {
            units.push(buf.trim());
            buf = '';
          }
          buf = `${buf} ${p}`;
        }
      }
      if (buf.trim()) units.push(buf.trim());
    }
  }
  const chunks: string[] = [];
  let current = '';
  for (const unit of units) {
    if (current && current.length + unit.length + 2 > budget) {
      chunks.push(current);
      const tail = current.length > opts.overlapChars ? current.slice(-opts.overlapChars) : '';
      const cleanTail = tail.includes(' ') ? tail.slice(tail.indexOf(' ') + 1) : tail;
      current = cleanTail && cleanTail.length + unit.length + 2 <= budget ? `${cleanTail}\n\n${unit}` : unit;
    } else {
      current = current ? `${current}\n\n${unit}` : unit;
    }
  }
  if (current) chunks.push(current);
  return chunks.map((c) => (prefix ? `${prefix}\n${c}` : c));
}

/** Markdown-ish documents: split on headings first so a heading stays with its paragraphs. */
export function chunkDocument(title: string, content: string, opts: ChunkOptions = DEFAULT_CHUNK_OPTIONS): Chunk[] {
  const text = cleanText(content);
  const sections: Array<{ heading: string; body: string }> = [];
  let heading = '';
  let body: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^#{1,4}\s+(.+)$/);
    if (m) {
      if (body.join('\n').trim()) sections.push({ heading, body: body.join('\n') });
      heading = m[1].trim();
      body = [];
    } else body.push(line);
  }
  if (body.join('\n').trim()) sections.push({ heading, body: body.join('\n') });

  const out: Chunk[] = [];
  for (const s of sections) {
    const prefix = s.heading ? `${title} › ${s.heading}` : title;
    for (const text of packText(s.body, prefix, opts)) out.push({ kind: 'section', title, text });
  }
  return out;
}

/** An FAQ stays one unit (question + answer) unless the answer is very long. */
export function chunkFaq(question: string, answer: string, opts: ChunkOptions = DEFAULT_CHUNK_OPTIONS): Chunk[] {
  const q = cleanText(question);
  const a = cleanText(answer);
  const whole = `Question: ${q}\nAnswer: ${a}`;
  if (whole.length <= opts.maxChars) return [{ kind: 'faq', title: q, text: whole }];
  return packText(a, `Question: ${q}\nAnswer (continued):`, opts).map((text) => ({ kind: 'faq', title: q, text }));
}
