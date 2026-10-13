/**
 * RAG evaluation runner.
 *   npm run eval:rag                 (deterministic fake provider; no network model calls)
 *   npm run eval:rag -- --openai     (real OpenAI embeddings/answers if OPENAI_API_KEY is set — use
 *                                     this to calibrate RETRIEVAL_MIN_SIMILARITY on real vectors)
 *
 * Seeds the fixture into the ISOLATED test schema, runs every dataset case through the real chat
 * pipeline, then sweeps evidence thresholds offline on the same retrieval results.
 * Writes tests/evaluation/report.json and prints a summary.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DB_SCHEMA = 'website_with_rag_test';
process.env.LOG_LEVEL = 'silent';

const here = dirname(fileURLToPath(import.meta.url));
const { createTestContext, drainQueue, ensureTestSchema, fakeLlm, noLlm, resetTestSchema, seedAdmins, seedDirectory, LISTINGS } = await import('../integration/helpers.js');
const { handleChat } = await import('../../src/chat/chatService.js');
const { OpenAiProvider } = await import('../../src/llm/openaiProvider.js');
const { analyzeQuery } = await import('../../src/rag/queryAnalysis.js');
const { retrieve } = await import('../../src/rag/retrieval.js');
const { assessEvidence } = await import('../../src/rag/evidence.js');
const { extractiveAnswer, noEvidenceAnswer } = await import('../../src/rag/generator.js');
const { resolveWithMemory } = await import('../../src/rag/memory.js');

interface Case {
  id: string;
  query: string;
  intent?: string;
  status: string[];
  expectSources: Array<keyof typeof LISTINGS>;
  mustContain?: string[];
  mustNotContain?: string[];
}
const dataset = JSON.parse(readFileSync(join(here, 'dataset.json'), 'utf8')) as { cases: Case[]; forbidSources: Array<keyof typeof LISTINGS>; forbidText: string[] };

const useOpenAi = process.argv.includes('--openai');
const provider = useOpenAi ? new OpenAiProvider() : process.argv.includes('--no-llm') ? noLlm() : fakeLlm(null);
if (useOpenAi && !provider.available) {
  console.error('--openai requested but OPENAI_API_KEY is not configured.');
  process.exit(1);
}

await ensureTestSchema();
const { ctx } = createTestContext(provider);
await resetTestSchema(ctx.db);
await seedAdmins(ctx.db);
await seedDirectory(ctx.db);
await drainQueue(ctx);

const nameOf = Object.fromEntries(Object.entries(LISTINGS).map(([k, v]) => [v, k]));
const forbiddenIds = new Set(dataset.forbidSources.map((k) => LISTINGS[k]));
const results = [];
const latencies: number[] = [];

for (const c of dataset.cases) {
  const started = performance.now();
  const r = await handleChat(ctx, { message: c.query, language: 'en' }, crypto.randomUUID(), `eval-${c.id}`);
  latencies.push(performance.now() - started);
  const cited = r.sources.filter((s) => s.type === 'listing').map((s) => nameOf[s.id] ?? s.id);
  const expected = new Set(c.expectSources);
  const tp = cited.filter((s) => expected.has(s as keyof typeof LISTINGS)).length;
  const problems: string[] = [];
  if (c.intent && r.meta.intent !== c.intent) problems.push(`intent ${r.meta.intent} ≠ ${c.intent}`);
  if (!c.status.includes(r.status)) problems.push(`status ${r.status} ∉ ${c.status.join('|')}`);
  if (expected.size && tp < expected.size) problems.push(`missing sources: ${[...expected].filter((e) => !cited.includes(e)).join(', ')}`);
  for (const s of r.sources) if (forbiddenIds.has(s.id)) problems.push(`forbidden source ${nameOf[s.id]}`);
  for (const t of [...dataset.forbidText, ...(c.mustNotContain ?? [])]) if (r.answer.toLowerCase().includes(t.toLowerCase())) problems.push(`forbidden text "${t}"`);
  for (const t of c.mustContain ?? []) if (!r.answer.toLowerCase().includes(t.toLowerCase())) problems.push(`missing text "${t}"`);
  results.push({
    id: c.id,
    query: c.query,
    pass: problems.length === 0,
    problems,
    intent: r.meta.intent,
    status: r.status,
    evidence: r.meta.evidence,
    generation: r.meta.generation,
    cited,
    precision: cited.length ? tp / cited.length : expected.size ? 0 : 1,
    recall: expected.size ? tp / expected.size : 1,
  });
}

// ---------------------------------------------------------------- offline threshold sweep
const lexicon = await ctx.lexicon.get();
const retrievals = [];
for (const c of dataset.cases) {
  const a = resolveWithMemory(analyzeQuery(c.query, lexicon), {}).analysis;
  if (['greeting', 'security_probe', 'fabrication_request', 'out_of_scope'].includes(a.intent)) continue;
  retrievals.push({ c, a, r: await retrieve(ctx, a) });
}
const sweep = [];
for (const partialCoverage of [0.2, 0.25, 0.34, 0.45, 0.6]) {
  for (const strongCoverage of [0.5, 0.6, 0.75]) {
    if (strongCoverage <= partialCoverage) continue;
    let ok = 0;
    for (const { c, a, r } of retrievals) {
      const ev = assessEvidence(a, r, { unresolved: a.intent === 'listing_detail' && !a.listings.length ? 'listing_reference' : null }, 8, {
        strongCoverage,
        partialCoverage,
        strongSimilarity: 0.5,
        minSimilarity: ctx.config.RETRIEVAL_MIN_SIMILARITY,
      });
      const status = ev.level === 'none' ? 'no_evidence' : ev.level === 'ambiguous' ? 'clarification' : ev.level === 'failure' ? 'technical_failure' : extractiveAnswer(a, ev).status;
      const ans = ev.level === 'none' ? noEvidenceAnswer(a) : extractiveAnswer(a, ev);
      const cited = ans.sources.filter((s) => s.type === 'listing').map((s) => nameOf[s.id]);
      const statusOk = c.status.includes(status) || (a.intent === 'live_info' && c.status.includes('limitation'));
      if (statusOk && c.expectSources.every((e) => cited.includes(e))) ok++;
    }
    sweep.push({ partialCoverage, strongCoverage, accuracy: Number((ok / retrievals.length).toFixed(3)) });
  }
}

const passed = results.filter((r) => r.pass).length;
const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const sorted = [...latencies].sort((a, b) => a - b);
const report = {
  at: new Date().toISOString(),
  provider: provider.name,
  cases: results.length,
  passed,
  passRate: Number((passed / results.length).toFixed(3)),
  intentAccuracy: Number((results.filter((r) => !r.problems.some((p) => p.startsWith('intent'))).length / results.length).toFixed(3)),
  meanSourcePrecision: Number(avg(results.map((r) => r.precision)).toFixed(3)),
  meanSourceRecall: Number(avg(results.map((r) => r.recall)).toFixed(3)),
  leaks: results.filter((r) => r.problems.some((p) => p.startsWith('forbidden'))).length,
  insufficientAnswers: results.filter((r) => r.problems.some((p) => p.includes('"insufficient"'))).length,
  latencyMs: { p50: Math.round(sorted[Math.floor(sorted.length * 0.5)]), p95: Math.round(sorted[Math.floor(sorted.length * 0.95)]) },
  thresholdSweep: sweep,
  results,
};
writeFileSync(join(here, 'report.json'), JSON.stringify(report, null, 2));
console.log(`Provider: ${report.provider}`);
console.log(`Pass rate: ${passed}/${results.length} (${(report.passRate * 100).toFixed(1)}%) | intent acc ${report.intentAccuracy} | precision ${report.meanSourcePrecision} | recall ${report.meanSourceRecall} | leaks ${report.leaks} | "insufficient" ${report.insufficientAnswers}`);
console.log(`Latency p50 ${report.latencyMs.p50} ms, p95 ${report.latencyMs.p95} ms (includes remote DB round-trips)`);
console.log('Threshold sweep (partial/strong coverage → accuracy):', sweep.map((s) => `${s.partialCoverage}/${s.strongCoverage}=${s.accuracy}`).join('  '));
for (const r of results.filter((x) => !x.pass)) console.log(`  FAIL ${r.id}: ${r.problems.join('; ')}`);
await ctx.db.close();
if (passed !== results.length) process.exitCode = 1;
