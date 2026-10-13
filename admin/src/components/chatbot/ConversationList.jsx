import { Link } from 'react-router-dom';
import { Flag, ThumbsDown, ThumbsUp } from 'lucide-react';
import { StatusBadge, Badge } from '@/components/common/Badge';
import { CONVERSATION_STATUSES, REVIEW_STATUSES } from '@/utils/constants';
import { formatRelative } from '@/utils/formatDate';

/** Feedback indicator with text (never colour alone). */
export function FeedbackIcon({ value }) {
  if (value === 'positive')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
        <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" /> Helpful
      </span>
    );
  if (value === 'negative')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
        <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" /> Not helpful
      </span>
    );
  return <span className="text-xs text-muted">No rating</span>;
}

/** Card list of conversations (used on small screens and in compact panels). */
export function ConversationList({ conversations }) {
  return (
    <ul className="divide-y divide-line">
      {conversations.map((c) => {
        const firstUser = c.messages.find((m) => m.role === 'user');
        return (
          <li key={c.id}>
            <Link to={`/chatbot/conversations/${c.id}`} className="block px-4 py-3 hover:bg-subtle/50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-ink">{c.id}</span>
                <StatusBadge status={c.status} map={CONVERSATION_STATUSES} />
                {c.reviewStatus === 'flagged' && (
                  <Badge tone="danger" icon={Flag}>
                    Flagged
                  </Badge>
                )}
                <span className="ml-auto text-xs text-muted">{formatRelative(c.startedAt)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-ink">“{firstUser?.text}”</p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                <span>{c.topic}</span>
                <span>{c.messageCount} messages</span>
                <FeedbackIcon value={c.feedback} />
                <span>{REVIEW_STATUSES[c.reviewStatus].label}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
