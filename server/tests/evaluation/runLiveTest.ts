/**
 * Acceptance test against the DEPLOYED assistant.
 *   npm run eval:live                                   (all groups; placeholder questions are skipped)
 *   npm run eval:live -- --api https://…/api/v1 --group client
 *
 * Every question is asked in a fresh conversation (no memory carried over), paced to stay inside the
 * public chat rate limit. Writes tests/evaluation/live-report.json and live-report.md with each
 * answer, its outcome and the sources it cited, for manual review.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const API = arg('--api') ?? 'https://ai-bajan-tourism-directory-server.vercel.app/api/v1';
const only = arg('--group');
const PACE_MS = 3500; // public limit is 20 questions per minute
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const { groups } = JSON.parse(readFileSync(join(here, 'liveQuestions.json'), 'utf8')) as { groups: Record<string, string[]> };

interface Result {
  group: string;
  question: string;
  status: string;
  answer: string;
  sources: Array<{ type: string; title: string; url?: string }>;
  ms: number;
}
const results: Result[] = [];

for (const [group, questions] of Object.entries(groups)) {
  if (only && group !== only) continue;
  for (const question of questions.filter((q) => !/to be supplied/i.test(q))) {
    let started = Date.now();
    let out: Result;
    // Wait out short local network drops so they are not reported as assistant failures.
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await fetch(API.replace(/\/api\/v1$/, '/health/ready'), { signal: AbortSignal.timeout(10_000) });
        break;
      } catch {
        console.log('  (network unavailable — retrying in 30s)');
        await sleep(30_000);
      }
    }
    started = Date.now();
    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, language: 'en', audience: group === 'visitors' || group === 'food-dining' ? 'visitor' : 'resident' }),
        signal: AbortSignal.timeout(60_000),
      });
      const j = (await res.json()) as { status?: string; answer?: string; sources?: Result['sources']; error?: { message: string } };
      out = { group, question, status: res.ok ? (j.status ?? 'unknown') : `http_${res.status}`, answer: j.answer ?? j.error?.message ?? '', sources: j.sources ?? [], ms: Date.now() - started };
    } catch (err) {
      out = { group, question, status: 'error', answer: (err as Error).message, sources: [], ms: Date.now() - started };
    }
    results.push(out);
    console.log(`[${results.length}] ${out.status.padEnd(12)} ${String(out.sources.length).padStart(2)} src  ${question}`);
    await sleep(Math.max(0, PACE_MS - (Date.now() - started)));
  }
}

const count = (s: string) => results.filter((r) => r.status === s).length;
const summary = {
  at: new Date().toISOString(),
  api: API,
  total: results.length,
  answered: count('answered'),
  partial: count('partial'),
  noEvidence: count('no_evidence'),
  clarification: count('clarification'),
  failed: results.filter((r) => !['answered', 'partial', 'no_evidence', 'clarification'].includes(r.status)).length,
  withSources: results.filter((r) => r.sources.length > 0).length,
};
writeFileSync(join(here, 'live-report.json'), JSON.stringify({ summary, results }, null, 2));

const md = [
  `# AI Bajan — live acceptance test`,
  ``,
  `Run ${summary.at} against ${API}`,
  ``,
  `| Questions | Answered | Partial | No answer found | Asked to clarify | Errors | Cited sources |`,
  `|---|---|---|---|---|---|---|`,
  `| ${summary.total} | ${summary.answered} | ${summary.partial} | ${summary.noEvidence} | ${summary.clarification} | ${summary.failed} | ${summary.withSources} |`,
  ``,
  ...results.flatMap((r, i) => [
    `## ${i + 1}. ${r.question}`,
    `*${r.group} · ${r.status} · ${(r.ms / 1000).toFixed(1)}s*`,
    ``,
    r.answer,
    ``,
    r.sources.length ? `Sources: ${r.sources.map((s) => (s.url ? `[${s.title}](${s.url})` : s.title)).join(' · ')}` : `Sources: none`,
    ``,
  ]),
].join('\n');
writeFileSync(join(here, 'live-report.md'), md);
console.log('\n', summary);
