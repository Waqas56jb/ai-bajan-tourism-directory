import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Download, Flag, MessagesSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useApiQuery } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useTableState';
import { useLookups } from '@/hooks/useLookups';
import { getConversations } from '@/services/chatbotService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { FilterBar } from '@/components/common/FilterBar';
import { SearchInput, SelectField } from '@/components/common/Fields';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { StatusBadge, Badge, DemoBadge } from '@/components/common/Badge';
import { ConversationList, FeedbackIcon } from '@/components/chatbot/ConversationList';
import { CONVERSATION_STATUSES, REVIEW_STATUSES } from '@/utils/constants';
import { formatDateTime, formatRelative, toInputDate } from '@/utils/formatDate';
import { exportCSV } from '@/utils/csv';

export default function ConversationsPage() {
  const {
    data: convos = [],
    isPending,
    isError,
    error,
    refetch,
  } = useApiQuery('conversations', getConversations);
  const { categoryName, listingById } = useLookups();
  const topics = useMemo(() => [...new Set(convos.map((c) => c.topic))].sort(), [convos]);

  const config = useMemo(
    () => ({
      searchFields: (c) => [c.id, c.topic, ...c.messages.map((m) => m.text)],
      filters: {
        feedback: (c, v) => (v === 'none' ? !c.feedback : c.feedback === v),
        fallback: (c, v) =>
          v === 'yes' ? c.messages.some((m) => m.fallback) : !c.messages.some((m) => m.fallback),
        topic: (c, v) => c.topic === v,
        status: (c, v) => c.status === v,
        review: (c, v) => c.reviewStatus === v,
      },
      dateField: 'startedAt',
      sorters: {
        startedAt: (c) => new Date(c.startedAt).getTime(),
        messages: (c) => c.messageCount,
        lastActivity: (c) => new Date(c.endedAt).getTime(),
      },
      defaultSort: { key: 'startedAt', dir: 'desc' },
    }),
    [],
  );
  const t = useTableState(convos, config);

  const exportRows = () => {
    exportCSV(`ai-bajan-conversations-${toInputDate(new Date())}.csv`, t.filtered, [
      { label: 'Conversation', value: 'id' },
      { label: 'Started', value: 'startedAt' },
      { label: 'Messages', value: 'messageCount' },
      { label: 'Topic', value: 'topic' },
      { label: 'Status', value: 'status' },
      { label: 'Feedback', value: (c) => c.feedback ?? '' },
      { label: 'Review', value: 'reviewStatus' },
      { label: 'First question', value: (c) => c.messages.find((m) => m.role === 'user')?.text ?? '' },
    ]);
    toast.success(`Exported ${t.filtered.length} conversations (sample data)`);
  };

  const chips = [
    t.q && { key: 'q', label: `Search: “${t.q}”`, onRemove: () => t.setQ('') },
    ...['feedback', 'fallback', 'topic', 'status', 'review']
      .filter((k) => t.filterValues[k])
      .map((k) => ({ key: k, label: `${k}: ${t.filterValues[k]}`, onRemove: () => t.setFilter(k, '') })),
    (t.dateFrom || t.dateTo) && { key: 'd', label: 'Date range', onRemove: () => t.setDateRange('', '') },
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Conversations"
        description="Review what visitors asked and how the assistant answered."
        badge={<DemoBadge>Sample transcripts</DemoBadge>}
        actions={
          <Button variant="outline" icon={Download} onClick={exportRows} disabled={!t.filtered.length}>
            Export CSV
          </Button>
        }
      />
      <Card padded={false}>
        <FilterBar chips={chips} onReset={t.resetAll}>
          <SearchInput
            value={t.q}
            onChange={t.setQ}
            label="Search conversations"
            placeholder="ID or message text"
            className="lg:w-64"
          />
          <SelectField
            label="Feedback"
            placeholder="Any"
            options={[
              { value: 'positive', label: 'Positive' },
              { value: 'negative', label: 'Negative' },
              { value: 'none', label: 'No rating' },
            ]}
            value={t.filterValues.feedback}
            onValueChange={(v) => t.setFilter('feedback', v)}
          />
          <SelectField
            label="Fallback"
            placeholder="Any"
            options={[
              { value: 'yes', label: 'Fallback occurred' },
              { value: 'no', label: 'No fallback' },
            ]}
            value={t.filterValues.fallback}
            onValueChange={(v) => t.setFilter('fallback', v)}
          />
          <SelectField
            label="Topic"
            placeholder="All topics"
            options={topics}
            value={t.filterValues.topic}
            onValueChange={(v) => t.setFilter('topic', v)}
          />
          <SelectField
            label="Answer status"
            placeholder="All"
            options={Object.entries(CONVERSATION_STATUSES).map(([k, s]) => ({ value: k, label: s.label }))}
            value={t.filterValues.status}
            onValueChange={(v) => t.setFilter('status', v)}
          />
          <SelectField
            label="Review"
            placeholder="All"
            options={Object.entries(REVIEW_STATUSES).map(([k, s]) => ({ value: k, label: s.label }))}
            value={t.filterValues.review}
            onValueChange={(v) => t.setFilter('review', v)}
          />
          <DateRangePicker label="Started" from={t.dateFrom} to={t.dateTo} onChange={t.setDateRange} />
        </FilterBar>

        {/* Compact card list on phones, table on larger screens */}
        <div className="md:hidden">
          {!isPending && t.pageItems.length > 0 && <ConversationList conversations={t.pageItems} />}
        </div>
        <div className={!isPending && t.pageItems.length > 0 ? 'hidden md:block' : ''}>
          <DataTable
            caption="Chatbot conversations"
            loading={isPending}
            error={isError ? error : null}
            onRetry={refetch}
            rows={t.pageItems}
            rowLabel={(c) => c.id}
            sort={{ key: t.sortKey, dir: t.sortDir, onSort: t.setSort }}
            empty={{
              icon: MessagesSquare,
              title: convos.length ? 'No conversations match your filters' : 'No conversations yet',
              action: convos.length ? (
                <Button size="sm" variant="outline" onClick={t.resetAll}>
                  Reset filters
                </Button>
              ) : null,
            }}
            columns={[
              {
                key: 'id',
                header: 'Conversation',
                cell: (c) => (
                  <div className="min-w-[15rem] max-w-md">
                    <Link
                      to={`/chatbot/conversations/${c.id}`}
                      className="font-mono text-xs font-semibold text-ink hover:text-accent-600"
                    >
                      {c.id}
                    </Link>
                    {c.reviewStatus === 'flagged' && (
                      <Badge tone="danger" icon={Flag} className="ml-2">
                        Flagged
                      </Badge>
                    )}
                    <p className="truncate text-sm text-ink">
                      “{c.messages.find((m) => m.role === 'user')?.text}”
                    </p>
                  </div>
                ),
              },
              {
                key: 'started',
                header: 'Started',
                sortKey: 'startedAt',
                cell: (c) => (
                  <span className="whitespace-nowrap text-muted" title={formatDateTime(c.startedAt)}>
                    {formatRelative(c.startedAt)}
                  </span>
                ),
              },
              {
                key: 'last',
                header: 'Last activity',
                sortKey: 'lastActivity',
                hideBelow: 'xl',
                cell: (c) => (
                  <span className="whitespace-nowrap text-muted">{formatDateTime(c.endedAt)}</span>
                ),
              },
              {
                key: 'messages',
                header: 'Msgs',
                sortKey: 'messages',
                align: 'right',
                cell: (c) => c.messageCount,
              },
              {
                key: 'topic',
                header: 'Topic',
                hideBelow: 'lg',
                cell: (c) => (
                  <div className="text-xs">
                    <p className="font-medium text-ink">{c.topic}</p>
                    <p className="text-muted">
                      {c.relatedListingId
                        ? listingById[c.relatedListingId]?.name
                        : c.relatedCategoryId
                          ? categoryName(c.relatedCategoryId)
                          : '—'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Answer',
                cell: (c) => <StatusBadge status={c.status} map={CONVERSATION_STATUSES} />,
              },
              {
                key: 'feedback',
                header: 'Feedback',
                hideBelow: 'lg',
                cell: (c) => <FeedbackIcon value={c.feedback} />,
              },
              {
                key: 'review',
                header: 'Review',
                hideBelow: 'xl',
                cell: (c) => <StatusBadge status={c.reviewStatus} map={REVIEW_STATUSES} />,
              },
            ]}
          />
        </div>
        <Pagination
          page={t.page}
          pageCount={t.pageCount}
          total={t.total}
          from={t.from}
          to={t.to}
          onPageChange={t.setPage}
          label="conversations"
        />
      </Card>
    </>
  );
}
