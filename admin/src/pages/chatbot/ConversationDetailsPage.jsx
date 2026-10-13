import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Copy, Download, Flag, FlagOff, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { useLookups } from '@/hooks/useLookups';
import { usePageTitle } from '@/context/PageMetaContext';
import { getConversationById, setConversationReview, addConversationNote } from '@/services/chatbotService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { StatusBadge, DemoBadge } from '@/components/common/Badge';
import { TextAreaField } from '@/components/common/Fields';
import { ErrorState, PageLoading } from '@/components/common/States';
import { ChatTranscript } from '@/components/chatbot/ChatTranscript';
import { SourceReferenceList } from '@/components/chatbot/SourceReferenceList';
import { FeedbackIcon } from '@/components/chatbot/ConversationList';
import { CONVERSATION_STATUSES, REVIEW_STATUSES } from '@/utils/constants';
import { formatDateTime, formatTime } from '@/utils/formatDate';
import { formatMs } from '@/utils/formatNumber';
import { downloadFile } from '@/utils/csv';
import NotFoundPage from '@/pages/errors/NotFoundPage';

function transcriptText(c) {
  const lines = [
    `AI Bajan conversation ${c.id} (demo transcript)`,
    `Started: ${formatDateTime(c.startedAt)}`,
    `Topic: ${c.topic}`,
    '',
  ];
  c.messages.forEach((m) => {
    lines.push(
      `[${formatTime(m.at)}] ${m.role === 'user' ? 'Visitor' : 'AI Bajan'}: ${m.text.replace(/\*\*/g, '')}`,
    );
    (m.sources ?? []).forEach((s) => lines.push(`    source: ${s.title}`));
  });
  return lines.join('\n');
}

export default function ConversationDetailsPage() {
  const { id } = useParams();
  const { listingById } = useLookups();
  const {
    data: c,
    isPending,
    isError,
    error,
    refetch,
  } = useApiQuery(['conversation', id], () => getConversationById(id));
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  usePageTitle(c ? `Conversation ${c.id}` : null);

  const review = useApiMutation((status) => setConversationReview(id, status), {
    invalidate: [['conversation'], ['conversations']],
    success: (x) =>
      x.reviewStatus === 'flagged'
        ? 'Flagged for investigation'
        : x.reviewStatus === 'reviewed'
          ? 'Marked as reviewed'
          : 'Review status cleared',
    error: 'Couldn’t update review status',
  });
  const addNote = useApiMutation((text) => addConversationNote(id, text), {
    invalidate: [['conversation'], ['conversations']],
    success: 'Internal note added',
    error: 'Couldn’t add the note',
    onSuccess: () => setNote(''),
  });

  if (isError && error?.status === 404)
    return (
      <NotFoundPage
        title="Conversation not found"
        backTo="/chatbot/conversations"
        backLabel="Back to conversations"
      />
    );
  if (isError)
    return (
      <Card>
        <ErrorState message={error?.message} onRetry={refetch} />
      </Card>
    );
  if (isPending) return <PageLoading />;

  const allSources = c.messages.flatMap((m) => m.sources ?? []);
  const uniqueSources = allSources.filter((s, i) => allSources.findIndex((x) => x.id === s.id) === i);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(transcriptText(c));
      toast.success('Transcript copied');
    } catch {
      toast.error('Couldn’t access the clipboard', { description: 'Use “Export as text” instead.' });
    }
  };

  return (
    <>
      <PageHeader
        title={`Conversation ${c.id}`}
        setTitle={false}
        badge={
          <>
            <StatusBadge status={c.status} map={CONVERSATION_STATUSES} />
            <StatusBadge status={c.reviewStatus} map={REVIEW_STATUSES} />
          </>
        }
        description={`${c.topic} · ${c.messageCount} messages · started ${formatDateTime(c.startedAt)}`}
        actions={
          <>
            <Button variant="outline" icon={Copy} onClick={copy}>
              Copy
            </Button>
            <Button
              variant="outline"
              icon={Download}
              onClick={() => {
                downloadFile(`${c.id}.txt`, transcriptText(c), 'text/plain;charset=utf-8');
                toast.success('Transcript exported');
              }}
            >
              Export as text
            </Button>
            {c.reviewStatus === 'flagged' ? (
              <Button
                variant="outline"
                icon={FlagOff}
                onClick={() => review.mutate('unreviewed')}
                loading={review.isPending}
              >
                Remove flag
              </Button>
            ) : (
              <Button
                variant="destructive-outline"
                icon={Flag}
                onClick={() => review.mutate('flagged')}
                loading={review.isPending}
              >
                Flag
              </Button>
            )}
            <Button
              icon={CheckCircle2}
              variant="accent"
              onClick={() => review.mutate('reviewed')}
              disabled={c.reviewStatus === 'reviewed' || review.isPending}
            >
              {c.reviewStatus === 'reviewed' ? 'Reviewed' : 'Mark reviewed'}
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Transcript" badge={<DemoBadge>Sample</DemoBadge>} />
          <ChatTranscript conversation={c} listingById={listingById} />
          <form
            className="mt-6 border-t border-line pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return setNoteError('Write a note before adding it.');
              addNote.mutate(note);
            }}
          >
            <TextAreaField
              label="Add internal note"
              rows={3}
              maxLength={1000}
              value={note}
              error={noteError}
              helper="Internal notes are only visible to admins."
              onChange={(e) => {
                setNote(e.target.value);
                setNoteError('');
              }}
            />
            <Button
              type="submit"
              variant="secondary"
              icon={StickyNote}
              className="mt-2"
              loading={addNote.isPending}
            >
              Add note
            </Button>
          </form>
        </Card>
        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader title="Details" />
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2">
                <dt className="text-xs text-muted">Conversation ID</dt>
                <dd className="font-mono text-xs">{c.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Started</dt>
                <dd>{formatDateTime(c.startedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Ended</dt>
                <dd>{formatDateTime(c.endedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Messages</dt>
                <dd>{c.messageCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Main topic</dt>
                <dd>{c.topic}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted">Feedback</dt>
                <dd className="mt-0.5">
                  <FeedbackIcon value={c.feedback} />
                </dd>
              </div>
            </dl>
          </Card>
          <Card>
            <CardHeader
              title="Retrieval diagnostics"
              description="User-safe metadata only — no model reasoning is stored or shown."
              badge={<DemoBadge>Mock</DemoBadge>}
            />
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted">Documents searched</dt>
                <dd>{c.retrieval.documentsSearched}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Sources cited</dt>
                <dd>{c.retrieval.sourcesUsed}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Response latency</dt>
                <dd>{formatMs(c.retrieval.latencyMs)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Fallbacks</dt>
                <dd>{c.messages.filter((m) => m.fallback).length}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Related sources" />
            {uniqueSources.length ? (
              <SourceReferenceList sources={uniqueSources} compact />
            ) : (
              <p className="text-sm text-muted">No sources were cited in this conversation.</p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
