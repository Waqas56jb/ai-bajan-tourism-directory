# Investigating a wrong or "can't find" chatbot answer

1. **Find the conversation.** Admin → Conversations (`GET /api/v1/admin/conversations?q=<words>`),
   or use the `X-Request-Id` the client saw.
2. **Open the diagnostics** (`GET /api/v1/admin/conversations/:id` → `diagnostics[]`, or
   `GET /api/v1/admin/monitoring/retrieval-logs?conversationId=…`). For each turn you get:
   * `intent` and `filters` — categories/locations/listings detected, product terms, attribute,
     what memory added (`memoryUsed`) or cleared (`memoryCleared`), the exact `tsquery`;
   * `methods` that ran (`structured`, `keyword`, `keyword_refined`, `vector`) and `errors` per method;
   * `candidateCount`, top `scores` (fused score, term coverage, vector similarity, keyword rank);
   * `evidence` level, `outcome`, `fallbackReason` (`no_relevant_evidence`, `llm_not_configured`,
     `llm_error:<kind>`, `answer_failed_validation`, `retrieval_failure`);
   * per-stage `latencyMs`, model ids and `configVersion`.
3. **Decide which layer is wrong:**

| Symptom in diagnostics | Likely cause | Fix |
| --- | --- | --- |
| `intent` unexpected, no category detected | Vocabulary gap | Add a synonym to the category (Admin → Categories → synonyms) — takes effect within 60 s, listings re-index automatically. |
| Category detected but `candidateCount` 0 | No published, chatbot-included listing in that category, or not indexed yet | Check listing status/“include in chatbot”; check `/admin/sync/jobs` for pending/failed jobs. |
| `errors` contains `vector` | OpenAI embedding outage/key problem | Answer still used keyword+structured; check `/admin/monitoring/health` and error events. |
| `evidence: failure` | Database/function unavailable | Check `/health/ready`, database status. User saw a technical-problem message (not "not found"). |
| Right sources, wrong wording | Model output | Check `fallbackReason`; if `answer_failed_validation` the model tried to add unsupported contact details. |
| Old content in answers | Sync lag or failed job | `/admin/sync/jobs?status=failed` → retry; `/admin/knowledge/documents/:id/chunks` shows exactly what is indexed. |

4. **Reproduce offline:** add the question to `tests/evaluation/dataset.json` (and, if needed, the
   fixture in `tests/integration/helpers.ts`) and run `npm run eval:rag`. Every bug fixed should
   become a regression case.
