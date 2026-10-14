import { useState } from 'react';
import { AlertTriangle, HelpCircle, MessageSquareText, SearchX } from 'lucide-react';
import { useApiQuery } from '@/hooks/useApi';
import { getQuestionsReport } from '@/services/classifiedService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState, ErrorState, PageLoading } from '@/components/common/States';
import { IS_LIVE } from '@/config/environment';
import { formatRelative } from '@/utils/formatDate';

const OUTCOME = {
  no_evidence: 'No answer found',
  technical_failure: 'Technical error',
  partial: 'Partial answer',
  clarification: 'Asked to clarify',
  not_helpful: 'Rated not helpful',
};
const POOR = new Set(Object.keys(OUTCOME));

export default function QuestionsReportPage() {
  const [days, setDays] = useState(90);
  const q = useApiQuery(['questions-report', days], () => getQuestionsReport(days));
  const r = q.data;
  return (
    <>
      <PageHeader
        title="Questions report"
        description="What people ask AI Bajan most, and the questions it answered poorly or could not answer. Questions are recorded anonymously and kept for at least 3 months."
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Period</span>
            <select className="field w-auto" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
        }
      />
      {q.isError ? (
        <Card>
          <ErrorState message={q.error?.message} onRetry={q.refetch} />
        </Card>
      ) : q.isPending ? (
        <PageLoading />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Questions asked" value={r.totals.questions} icon={MessageSquareText} />
            <StatCard label="Different questions" value={r.totals.uniqueQuestions} icon={HelpCircle} tone="info" />
            <StatCard label="Poorly answered" value={r.totals.poorlyAnswered} icon={AlertTriangle} tone="warning" />
            <StatCard label="No answer found" value={r.totals.noAnswer} icon={SearchX} tone="danger" />
          </div>

          <Card padded={false}>
            <CardHeader className="mb-0 p-5" title="Most-asked questions" description="Similar wording is grouped together." />
            {r.top.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-subtle text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-5 py-2.5 font-semibold">Question</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Asked</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Poor answers</th>
                      <th className="px-5 py-2.5 font-semibold">Last asked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {r.top.map((t) => (
                      <tr key={t.question}>
                        <td className="px-5 py-2.5 text-ink">{t.question}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{t.asked}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{t.poorAnswers ? <Badge tone="warning">{t.poorAnswers}</Badge> : '—'}</td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-muted">{formatRelative(t.lastAsked)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No questions yet" description={IS_LIVE ? 'Questions asked on the website appear here.' : 'The report is only available when connected to the live API.'} />
            )}
          </Card>

          <Card padded={false}>
            <CardHeader
              className="mb-0 p-5"
              title="Poorly answered or unanswered"
              description="Add a knowledge document or FAQ that covers these, then run Knowledge Sync. The next answer will use it."
            />
            {r.poor.length ? (
              <ul className="divide-y divide-line">
                {r.poor.map((p) => (
                  <li key={p.question} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="text-ink">{p.question}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {[...(p.outcomes ?? []).filter((o) => POOR.has(o)), ...(p.notHelpful ? ['not_helpful'] : [])].map((o) => (
                          <Badge key={o} tone={o === 'no_evidence' ? 'danger' : 'warning'}>{OUTCOME[o]}</Badge>
                        ))}
                      </div>
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted">
                      asked {p.asked}× · {formatRelative(p.lastAsked)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nothing to fix" description="No poorly answered questions in this period." />
            )}
          </Card>
        </div>
      )}
    </>
  );
}
