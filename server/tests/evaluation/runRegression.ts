/**
 * Accuracy regression test against the DEPLOYED assistant. Run it after every change:
 *   npm run eval:regression
 *   npm run eval:regression -- --api https://…/api/v1 --only 12,41,85
 *
 * Every question in regression.json is asked in a fresh conversation and its answer is checked
 * automatically against verified facts:
 *   include: groups of alternatives — the answer must contain at least one phrase of every group
 *   exclude: phrases that signal a known error — the answer must contain none of them
 * Questions previously graded correct are marked "protected": a failure there is a regression.
 * Writes tests/evaluation/regression-report.json and exits with code 1 if any check fails.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const API = arg('--api') ?? 'https://ai-bajan-tourism-directory-server.vercel.app/api/v1';
const only = arg('--only')?.split(',').map(Number);
const PACE_MS = 3500; // public limit is 20 questions per minute
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Case {
  n: number;
  question: string;
  audience?: 'resident' | 'visitor';
  protected?: boolean;
  checks: { include: string[][]; exclude: string[] } | null;
  basis: string;
  source: string;
}

/** Lower-cases and straightens quotes/dashes so wording differences do not fail a check. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');

export function evaluate(answer: string, checks: NonNullable<Case['checks']>) {
  const text = norm(answer);
  const missing = checks.include.filter((group) => !group.some((p) => text.includes(norm(p))));
  const found = checks.exclude.filter((p) => text.includes(norm(p)));
  return { pass: missing.length === 0 && found.length === 0, missing, found };
}

async function ask(question: string, audience: string): Promise<{ status: string; answer: string; sources: Array<{ title: string; url?: string; tier?: string }> }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, language: 'en', audience }),
        signal: AbortSignal.timeout(60_000),
      });
      const j = (await res.json()) as { status?: string; answer?: string; sources?: [] ; error?: { message: string } };
      if (res.status === 429) {
        await sleep(20_000);
        continue;
      }
      return { status: res.ok ? (j.status ?? 'unknown') : `http_${res.status}`, answer: j.answer ?? j.error?.message ?? '', sources: j.sources ?? [] };
    } catch {
      await sleep(30_000); // local network drop: retry rather than report a false failure
    }
  }
  return { status: 'error', answer: '', sources: [] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { cases } = JSON.parse(readFileSync(join(here, 'regression.json'), 'utf8')) as { cases: Case[] };
  const results = [];
  for (const c of cases.filter((c) => c.checks && (!only || only.includes(c.n)))) {
    const started = Date.now();
    const r = await ask(c.question, c.audience ?? 'resident');
    const e = evaluate(r.answer, c.checks!);
    results.push({ n: c.n, question: c.question, protected: Boolean(c.protected), ...e, status: r.status, answer: r.answer, sources: r.sources, basis: c.basis });
    const tag = e.pass ? 'PASS' : c.protected ? 'REGRESSION' : 'FAIL';
    console.log(`${tag.padEnd(10)} #${String(c.n).padStart(3)} ${c.question}${e.pass ? '' : `\n           missing: ${JSON.stringify(e.missing)}  wrong: ${JSON.stringify(e.found)}`}`);
    await sleep(Math.max(0, PACE_MS - (Date.now() - started)));
  }
  const summary = {
    at: new Date().toISOString(),
    api: API,
    checked: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    regressions: results.filter((r) => !r.pass && r.protected).map((r) => r.n),
    skipped: cases.filter((c) => !c.checks).length,
  };
  writeFileSync(join(here, 'regression-report.json'), JSON.stringify({ summary, results }, null, 2));
  console.log('\n', summary);
  process.exit(summary.failed ? 1 : 0);
}
