import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Eye, MessageSquareText, MoreHorizontal, RotateCcw, StickyNote } from 'lucide-react';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useTableState';
import { useLookups } from '@/hooks/useLookups';
import { getFeedback, updateFeedback, addFeedbackNote } from '@/services/feedbackService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { FilterBar } from '@/components/common/FilterBar';
import { SearchInput, SelectField, TextAreaField } from '@/components/common/Fields';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import { StatusBadge } from '@/components/common/Badge';
import { Drawer } from '@/components/common/Modal';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { FEEDBACK_STATUSES, FEEDBACK_TYPES, PRIORITIES } from '@/utils/constants';
import { formatDateTime, formatRelative } from '@/utils/formatDate';

function relatedLink(f) {
  if (f.relatedType === 'listing') return `/listings/${f.relatedId}`;
  if (f.relatedType === 'conversation') return `/chatbot/conversations/${f.relatedId}`;
  return null;
}

export default function FeedbackPage() {
  const { data: items = [], isPending, isError, error, refetch } = useApiQuery('feedback', getFeedback);
  const { listingById } = useLookups();
  const [openId, setOpenId] = useState(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const confirm = useConfirm();

  const relatedLabel = (f) =>
    f.relatedType === 'listing'
      ? (listingById[f.relatedId]?.name ?? f.relatedId)
      : f.relatedType === 'conversation'
        ? `Conversation ${f.relatedId}`
        : '—';

  const config = useMemo(
    () => ({
      searchFields: (f) => [f.id, f.summary, f.text, f.submittedBy],
      filters: {
        type: (f, v) => f.type === v,
        status: (f, v) => f.status === v,
        priority: (f, v) => f.priority === v,
      },
      dateField: 'submittedAt',
      sorters: {
        submittedAt: (f) => new Date(f.submittedAt).getTime(),
        priority: (f) => ['high', 'medium', 'low'].indexOf(f.priority),
      },
      defaultSort: { key: 'submittedAt', dir: 'desc' },
    }),
    [],
  );
  const t = useTableState(items, config);

  const update = useApiMutation(({ id, changes }) => updateFeedback(id, changes), {
    invalidate: [['feedback']],
    success: (f) => `${f.id} marked ${FEEDBACK_STATUSES[f.status].label.toLowerCase()}`,
    error: 'Couldn’t update feedback',
  });
  const addNote = useApiMutation(({ id, text }) => addFeedbackNote(id, text), {
    invalidate: [['feedback']],
    success: 'Internal note added',
    error: 'Couldn’t add note',
    onSuccess: () => setNote(''),
  });

  const resolve = async (f) => {
    const { confirmed, value } = await confirm({
      title: `Resolve ${f.id}?`,
      message: f.summary,
      confirmLabel: 'Mark resolved',
      input: {
        label: 'Resolution summary',
        required: true,
        defaultValue: f.resolution,
        placeholder: 'What was done?',
      },
    });
    if (confirmed) update.mutate({ id: f.id, changes: { status: 'resolved', resolution: value } });
  };

  const menu = (f) =>
    [
      { label: 'Open details', icon: Eye, onSelect: () => setOpenId(f.id) },
      f.status === 'new' && {
        label: 'Mark as reviewed',
        icon: MessageSquareText,
        onSelect: () => update.mutate({ id: f.id, changes: { status: 'reviewed' } }),
      },
      f.status !== 'resolved' && {
        label: 'Mark as resolved',
        icon: CheckCircle2,
        onSelect: () => resolve(f),
      },
      f.status === 'resolved' && {
        label: 'Reopen',
        icon: RotateCcw,
        onSelect: () => update.mutate({ id: f.id, changes: { status: 'reopened' } }),
      },
      relatedLink(f) && {
        label: f.relatedType === 'listing' ? 'Go to listing' : 'Go to conversation',
        icon: Eye,
        to: relatedLink(f),
        separatorBefore: true,
      },
    ].filter(Boolean);

  const open = items.find((f) => f.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Feedback & reports"
        description="Visitor reports and chatbot feedback that need attention."
      />
      <Card padded={false}>
        <FilterBar
          chips={[
            t.q && { key: 'q', label: `Search: “${t.q}”`, onRemove: () => t.setQ('') },
            t.filterValues.type && {
              key: 't',
              label: FEEDBACK_TYPES[t.filterValues.type],
              onRemove: () => t.setFilter('type', ''),
            },
            t.filterValues.status && {
              key: 's',
              label: FEEDBACK_STATUSES[t.filterValues.status].label,
              onRemove: () => t.setFilter('status', ''),
            },
            t.filterValues.priority && {
              key: 'p',
              label: `${PRIORITIES[t.filterValues.priority].label} priority`,
              onRemove: () => t.setFilter('priority', ''),
            },
            (t.dateFrom || t.dateTo) && {
              key: 'd',
              label: 'Date range',
              onRemove: () => t.setDateRange('', ''),
            },
          ].filter(Boolean)}
          onReset={t.resetAll}
        >
          <SearchInput
            value={t.q}
            onChange={t.setQ}
            label="Search feedback"
            placeholder="ID, summary or text"
            className="lg:w-64"
          />
          <SelectField
            label="Type"
            placeholder="All types"
            options={Object.entries(FEEDBACK_TYPES).map(([k, l]) => ({ value: k, label: l }))}
            value={t.filterValues.type}
            onValueChange={(v) => t.setFilter('type', v)}
          />
          <SelectField
            label="Status"
            placeholder="All"
            options={Object.entries(FEEDBACK_STATUSES).map(([k, s]) => ({ value: k, label: s.label }))}
            value={t.filterValues.status}
            onValueChange={(v) => t.setFilter('status', v)}
          />
          <SelectField
            label="Priority"
            placeholder="All"
            options={Object.entries(PRIORITIES).map(([k, s]) => ({ value: k, label: s.label }))}
            value={t.filterValues.priority}
            onValueChange={(v) => t.setFilter('priority', v)}
          />
          <DateRangePicker label="Submitted" from={t.dateFrom} to={t.dateTo} onChange={t.setDateRange} />
        </FilterBar>
        <DataTable
          caption="Feedback"
          loading={isPending}
          error={isError ? error : null}
          onRetry={refetch}
          rows={t.pageItems}
          rowLabel={(f) => f.id}
          sort={{ key: t.sortKey, dir: t.sortDir, onSort: t.setSort }}
          empty={{
            icon: MessageSquareText,
            title: items.length ? 'No matching feedback' : 'No feedback yet',
          }}
          columns={[
            {
              key: 'id',
              header: 'ID',
              cell: (f) => (
                <button
                  type="button"
                  onClick={() => setOpenId(f.id)}
                  className="font-mono text-xs font-semibold hover:text-accent-600"
                >
                  {f.id}
                </button>
              ),
            },
            {
              key: 'summary',
              header: 'Summary',
              cell: (f) => (
                <div className="min-w-[14rem] max-w-md">
                  <button
                    type="button"
                    onClick={() => setOpenId(f.id)}
                    className="block truncate text-left font-medium text-ink hover:text-accent-600"
                  >
                    {f.summary}
                  </button>
                  <p className="truncate text-xs text-muted">{FEEDBACK_TYPES[f.type]}</p>
                </div>
              ),
            },
            {
              key: 'related',
              header: 'Related',
              hideBelow: 'lg',
              cell: (f) =>
                relatedLink(f) ? (
                  <Link
                    to={relatedLink(f)}
                    className="block max-w-[12rem] truncate text-accent-600 hover:underline"
                  >
                    {relatedLabel(f)}
                  </Link>
                ) : (
                  <span className="text-muted">—</span>
                ),
            },
            {
              key: 'date',
              header: 'Submitted',
              sortKey: 'submittedAt',
              hideBelow: 'md',
              cell: (f) => (
                <span className="whitespace-nowrap text-muted">{formatRelative(f.submittedAt)}</span>
              ),
            },
            {
              key: 'priority',
              header: 'Priority',
              sortKey: 'priority',
              hideBelow: 'sm',
              cell: (f) => <StatusBadge status={f.priority} map={PRIORITIES} />,
            },
            {
              key: 'status',
              header: 'Status',
              cell: (f) => <StatusBadge status={f.status} map={FEEDBACK_STATUSES} />,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (f) => (
                <DropdownMenu
                  label={`Actions for ${f.id}`}
                  items={menu(f)}
                  trigger={<IconButton label={`Actions for ${f.id}`} icon={MoreHorizontal} tooltip={false} />}
                />
              ),
            },
          ]}
        />
        <Pagination
          page={t.page}
          pageCount={t.pageCount}
          total={t.total}
          from={t.from}
          to={t.to}
          onPageChange={t.setPage}
          label="reports"
        />
      </Card>

      <Drawer
        open={Boolean(open)}
        onOpenChange={(o) => {
          if (!o) {
            setOpenId(null);
            setNote('');
            setNoteError('');
          }
        }}
        title={open?.summary ?? ''}
        description={open ? `${open.id} · ${FEEDBACK_TYPES[open.type]}` : ''}
        footer={
          open && (
            <>
              {relatedLink(open) && (
                <Button variant="outline" to={relatedLink(open)}>
                  Open related {open.relatedType}
                </Button>
              )}
              {open.status === 'new' && (
                <Button
                  variant="secondary"
                  onClick={() => update.mutate({ id: open.id, changes: { status: 'reviewed' } })}
                >
                  Mark reviewed
                </Button>
              )}
              {open.status === 'resolved' ? (
                <Button
                  variant="outline"
                  icon={RotateCcw}
                  onClick={() => update.mutate({ id: open.id, changes: { status: 'reopened' } })}
                >
                  Reopen
                </Button>
              ) : (
                <Button variant="accent" icon={CheckCircle2} onClick={() => resolve(open)}>
                  Resolve
                </Button>
              )}
            </>
          )
        }
      >
        {open && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={open.status} map={FEEDBACK_STATUSES} />
              <StatusBadge status={open.priority} map={PRIORITIES} />
            </div>
            <blockquote className="rounded-xl border-l-4 border-accent bg-subtle/60 p-4 text-ink">
              “{open.text}”
            </blockquote>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted">Submitted by</dt>
                <dd>{open.submittedBy}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Submitted</dt>
                <dd>{formatDateTime(open.submittedAt)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted">Related record</dt>
                <dd>
                  {relatedLink(open) ? (
                    <Link to={relatedLink(open)} className="text-accent-600 hover:underline">
                      {relatedLabel(open)}
                    </Link>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              {open.resolution && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted">Resolution</dt>
                  <dd>{open.resolution}</dd>
                </div>
              )}
            </dl>
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Internal notes
              </h3>
              {open.notes?.length ? (
                <ul className="space-y-2">
                  {open.notes.map((n) => (
                    <li key={n.id} className="rounded-xl border border-dashed border-sand bg-sand/10 p-3">
                      <p className="text-xs font-semibold text-sand-600">
                        {n.author} · {formatRelative(n.at)}
                      </p>
                      <p className="mt-1">{n.text}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">No notes yet.</p>
              )}
              <form
                className="mt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!note.trim()) return setNoteError('Write a note first.');
                  addNote.mutate({ id: open.id, text: note });
                }}
              >
                <TextAreaField
                  label="Add internal note"
                  rows={2}
                  value={note}
                  error={noteError}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setNoteError('');
                  }}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  icon={StickyNote}
                  className="mt-2"
                  loading={addNote.isPending}
                >
                  Add note
                </Button>
              </form>
            </section>
          </div>
        )}
      </Drawer>
    </>
  );
}
