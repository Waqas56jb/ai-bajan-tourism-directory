import { useState } from 'react';
import { Briefcase, ChevronDown, Mail, MessageCircle, Phone, Tag, Trash2 } from 'lucide-react';
import { useApiMutation, useApiQuery } from '@/hooks/useApi';
import { deleteClassified, getClassifieds, updateClassified } from '@/services/classifiedService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { EmptyState, ErrorState, PageLoading } from '@/components/common/States';
import { IS_LIVE } from '@/config/environment';
import { formatDate, formatRelative } from '@/utils/formatDate';

const STATUS = {
  pending: { label: 'Awaiting approval', tone: 'warning' },
  approved: { label: 'Live', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  expired: { label: 'Expired', tone: 'neutral' },
};
/** Date-only string `offset` days from today. */
const day = (offset) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10);

function Fact({ label, value }) {
  if (!value) return null;
  return (
    <div className="contents">
      <dt className="font-medium text-muted">{label}</dt>
      <dd className="whitespace-pre-line break-words text-ink">{value}</dd>
    </div>
  );
}

function AdCard({ ad }) {
  const [open, setOpen] = useState(ad.status === 'pending');
  const [note, setNote] = useState(ad.reviewNote ?? '');
  const current = ad.expiresAt ? String(ad.expiresAt).slice(0, 10) : null;
  const [expiresAt, setExpiresAt] = useState(current && current >= day(0) ? current : day(30));
  const confirm = useConfirm();
  const update = useApiMutation(
    (status) => updateClassified(ad.id, { status, reviewNote: note.trim() || undefined, ...(status === 'approved' ? { expiresAt } : {}) }),
    {
      invalidate: [['classifieds']],
      success: (_d, status) => (status === 'approved' ? `Advert live until ${formatDate(expiresAt)}` : `Advert marked ${STATUS[status].label.toLowerCase()}`),
      error: 'Couldn’t update the advert',
    },
  );
  const remove = useApiMutation(() => deleteClassified(ad.id), { invalidate: [['classifieds']], success: 'Advert deleted', error: 'Couldn’t delete the advert' });
  const isJob = ad.kind === 'job';
  const Icon = isJob ? Briefcase : Tag;
  const status = STATUS[ad.status] ?? { label: ad.status, tone: 'neutral' };
  return (
    <Card>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-3 text-left" aria-expanded={open}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent-600">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{ad.title}</span>
            <Badge tone={status.tone} dot>{status.label}</Badge>
            <Badge tone="neutral">{isJob ? 'Job' : 'Classified'}</Badge>
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {isJob && ad.employer ? `${ad.employer} · ` : ''}submitted {formatRelative(ad.createdAt)}
            {ad.status === 'approved' && ad.expiresAt ? ` · expires ${formatDate(ad.expiresAt)}` : ''}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="whitespace-pre-line text-sm text-ink">{ad.description}</p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
              <Fact label="Category" value={ad.category} />
              <Fact label="Employment type" value={ad.employmentType} />
              <Fact label="Salary" value={ad.salary} />
              <Fact label="Qualifications" value={ad.qualifications} />
              <Fact label="Apply by" value={ad.applyDeadline && formatDate(ad.applyDeadline)} />
              <Fact label="How to apply" value={ad.applyUrl} />
              <Fact label="Price" value={ad.price} />
              <Fact label="Condition" value={ad.itemCondition} />
              <Fact label="Area" value={[ad.area, ad.locationName].filter(Boolean).join(', ')} />
            </dl>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl bg-subtle p-4 text-sm">
              <p className="font-semibold text-ink">{ad.contactName}</p>
              {ad.contactPhone && (
                <p className="mt-1 flex items-center gap-1.5 text-muted">
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" /> {ad.contactPhone}
                </p>
              )}
              {ad.contactWhatsapp && (
                <p className="mt-1 flex items-center gap-1.5 text-muted">
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> {ad.contactWhatsapp}
                </p>
              )}
              {ad.contactEmail && (
                <p className="mt-1 flex items-center gap-1.5 text-muted">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  <a href={`mailto:${ad.contactEmail}`} className="text-accent-600 hover:underline">{ad.contactEmail}</a>
                </p>
              )}
            </div>
            <label className="block text-sm">
              <span className="label">Show until (expiry date)</span>
              <input type="date" className="field mt-1" value={expiresAt} min={day(0)} max={day(120)} onChange={(e) => setExpiresAt(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="label">Review note (internal)</span>
              <textarea className="field mt-1 min-h-[70px]" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={!expiresAt} loading={update.isPending && update.variables === 'approved'} onClick={() => update.mutate('approved')}>
                {ad.status === 'approved' ? 'Update expiry' : 'Approve'}
              </Button>
              {ad.status !== 'rejected' && (
                <Button variant="outline" size="sm" loading={update.isPending && update.variables === 'rejected'} onClick={() => update.mutate('rejected')}>
                  Reject
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                loading={remove.isPending}
                onClick={async () => {
                  const ok = await confirm({ title: 'Delete this advert?', message: 'It is removed from the website and from AI Bajan answers permanently.', confirmLabel: 'Delete', tone: 'danger' });
                  if (ok) remove.mutate();
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
              </Button>
            </div>
            <p className="text-xs text-muted">Approved adverts appear on the website and in AI Bajan answers until the expiry date, then disappear automatically.</p>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function ClassifiedsPage() {
  const [filter, setFilter] = useState('pending');
  const q = useApiQuery('classifieds', getClassifieds);
  const all = q.data ?? [];
  const items = all.filter((a) => filter === 'all' || a.status === filter);
  const count = (s) => all.filter((a) => a.status === s).length;
  return (
    <>
      <PageHeader
        title="Jobs & classifieds"
        description="Adverts submitted on the public website. Nothing is published until you approve it, and every approved advert has an expiry date."
      />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Filter adverts">
        {[
          ['pending', `Awaiting approval (${count('pending')})`],
          ['approved', `Live (${count('approved')})`],
          ['expired', 'Expired'],
          ['rejected', 'Rejected'],
          ['all', 'All'],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={filter === k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ${filter === k ? 'bg-ink text-surface ring-ink' : 'text-muted ring-line hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {q.isError ? (
        <Card>
          <ErrorState message={q.error?.message} onRetry={q.refetch} />
        </Card>
      ) : q.isPending ? (
        <PageLoading />
      ) : items.length ? (
        <div className="space-y-4">
          {items.map((a) => (
            <AdCard key={a.id} ad={a} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="No adverts here"
            description={IS_LIVE ? 'Jobs and classified ads posted on the public website appear here for approval.' : 'Adverts are only available when connected to the live API.'}
          />
        </Card>
      )}
    </>
  );
}
