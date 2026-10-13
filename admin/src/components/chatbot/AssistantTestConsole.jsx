import { useState } from 'react';
import { FlaskConical, Send } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { api } from '@/services/live/http';

/**
 * Admin-only test console: asks the real assistant pipeline even while the public chat is still
 * switched off, so answer quality can be checked (e.g. against ChatGPT) before launch.
 */
export function AssistantTestConsole() {
  const [question, setQuestion] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [turns, setTurns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ask = async (e) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await api('/admin/chat/test', { method: 'POST', body: { message: q, ...(conversationId ? { conversationId } : {}) }, timeout: 60000 });
      setConversationId(r.conversationId);
      setTurns((t) => [...t, { q, r }]);
      setQuestion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const llm = turns.at(-1)?.r?.llmConfigured;
  return (
    <Card className="mb-6">
      <CardHeader
        title="Test the assistant"
        description="Ask questions privately to check answer quality before the public chat is switched on. Follow-up questions use the same conversation."
        badge={
          llm === false ? (
            <Badge tone="warning" icon={FlaskConical}>
              No AI model connected — keyword/extractive answers only
            </Badge>
          ) : null
        }
      />
      <div className="max-h-[420px] space-y-4 overflow-y-auto">
        {turns.map(({ q, r }, i) => (
          <div key={i} className="rounded-xl border border-line p-3">
            <p className="text-sm font-semibold text-ink">Q: {q}</p>
            <p className="mt-2 whitespace-pre-line text-sm text-ink">{r.answer}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-2xs text-muted">
              <Badge tone="neutral">{r.status}</Badge>
              <Badge tone="neutral">intent: {r.meta?.intent}</Badge>
              <Badge tone="neutral">evidence: {r.meta?.evidence}</Badge>
              <Badge tone="neutral">{r.meta?.generation}</Badge>
            </div>
            {r.sources?.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs text-muted">
                {r.sources.map((s) => (
                  <li key={s.id}>
                    {s.title}
                    {s.url && /^https?:\/\//.test(s.url) ? (
                      <>
                        {' '}
                        —{' '}
                        <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-600 underline">
                          source
                        </a>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <form onSubmit={ask} className="mt-4 flex gap-2">
        <input
          className="field flex-1"
          value={question}
          maxLength={1000}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What are Bajan fish cakes?"
          aria-label="Test question"
        />
        <Button type="submit" icon={Send} loading={busy} disabled={!question.trim()}>
          Ask
        </Button>
        {turns.length > 0 && (
          <Button
            variant="outline"
            onClick={() => {
              setTurns([]);
              setConversationId(null);
            }}
          >
            New conversation
          </Button>
        )}
      </form>
    </Card>
  );
}
