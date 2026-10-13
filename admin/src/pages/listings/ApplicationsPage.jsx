import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ExternalLink, GraduationCap, Mail, Phone, Store } from 'lucide-react';
import { useApiMutation, useApiQuery } from '@/hooks/useApi';
import { getApplications, updateApplication } from '@/services/applicationService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { EmptyState, ErrorState, PageLoading } from '@/components/common/States';
import { IS_LIVE } from '@/config/environment';
import { formatDate, formatRelative } from '@/utils/formatDate';

const STATUS = {
  new: { label: 'New', tone: 'info' },
  in_review: { label: 'In review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};
const PLAN = {
  free: 'Free',
  verified: 'Verified',
  business_plus: 'Business Plus',
  professional_partner: 'Professional Partner',
  sponsored_category: 'Sponsored Category',
  contributor: 'Content provider',
};

/** Human labels for submitted fields (everything else is shown with its key). */
const FIELD_LABELS = {
  registeredName: 'Registered name',
  tradingName: 'Trading name',
  categoryOther: 'Business type',
  description: 'Description',
  productsServices: 'Products and services',
  address: 'Address',
  mapUrl: 'Map',
  phone: 'Telephone',
  whatsapp: 'WhatsApp',
  email: 'Email',
  website: 'Website',
  socialLinks: 'Social links',
  openingHours: 'Opening hours',
  areasServed: 'Areas served',
  priceRange: 'Prices',
  bookingPaymentDelivery: 'Booking, payment and delivery',
  faqs: 'FAQs',
  mediaLinks: 'Photos / menus / brochures',
  registrationNumber: 'Company registration',
  licenceNumber: 'Professional licence',
  organisationName: 'Organisation',
  contributorType: 'Contributor type',
  expertise: 'Topics',
  sampleSources: 'Sources / publications',
  qualifications: 'Qualifications',
  publicationNotes: 'Publication dates and notes',
  correctionsEmail: 'Corrections email',
};
const HIDDEN = new Set(['kind', 'plan', 'contactName', 'contactRole', 'contactEmail', 'contactPhone', 'consentToUse', 'infoAccurate', 'copyrightPermission', 'categoryId', 'locationId']);

function Value({ value }) {
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-muted">—</span>;
    if (typeof value[0] === 'object') {
      return (
        <ul className="space-y-1">
          {value.map((f, i) => (
            <li key={i}>
              <strong>{f.question}</strong> — {f.answer}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <ul className="space-y-0.5">
        {value.map((v) => (
          <li key={v} className="break-all">{v}</li>
        ))}
      </ul>
    );
  }
  return value ? <span className="whitespace-pre-line break-words">{String(value)}</span> : <span className="text-muted">—</span>;
}

function ApplicationCard({ a }) {
  const [open, setOpen] = useState(a.status === 'new');
  const [note, setNote] = useState(a.reviewNote ?? '');
  const update = useApiMutation((status) => updateApplication(a.id, { status, reviewNote: note.trim() || undefined }), {
    invalidate: [['applications'], ['listings']],
    success: (_d, status) => `Application marked ${STATUS[status].label.toLowerCase()}`,
    error: 'Couldn’t update the application',
  });
  const Icon = a.kind === 'business' ? Store : GraduationCap;
  const details = Object.entries(a.details ?? {}).filter(([k]) => !HIDDEN.has(k));
  return (
    <Card>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-3 text-left" aria-expanded={open}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent-600">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{a.organisationName}</span>
            <Badge tone={STATUS[a.status].tone} dot>{STATUS[a.status].label}</Badge>
            <Badge tone="neutral">{PLAN[a.plan] ?? a.plan}</Badge>
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {a.kind === 'business' ? 'Business sign-up' : 'Content provider'} · submitted {formatRelative(a.createdAt)} ({formatDate(a.createdAt)})
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <dl className="grid gap-3 text-sm sm:grid-cols-[11rem_1fr]">
            {details.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-medium text-muted">{FIELD_LABELS[k] ?? k}</dt>
                <dd className="text-ink">
                  <Value value={v} />
                </dd>
              </div>
            ))}
          </dl>
          <div className="space-y-4">
            <div className="rounded-xl bg-subtle p-4 text-sm">
              <p className="font-semibold text-ink">Authorised contact</p>
              <p className="mt-1 text-ink">
                {a.contactName}
                {a.contactRole ? ` · ${a.contactRole}` : ''}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-muted">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                <a href={`mailto:${a.contactEmail}`} className="text-accent-600 hover:underline">{a.contactEmail}</a>
              </p>
              {a.contactPhone && (
                <p className="mt-1 flex items-center gap-1.5 text-muted">
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" /> {a.contactPhone}
                </p>
              )}
              <p className="mt-2 text-xs text-muted">Permission to use the information was given on submission.</p>
            </div>
            {a.listingId && (
              <Link to={`/listings/${a.listingId}`} className="flex items-center gap-1.5 text-sm font-semibold text-accent-600 hover:underline">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open the {a.listingStatus ?? 'pending'} listing{a.listingVerified ? ' (verified)' : ''} to edit, publish or verify it
              </Link>
            )}
            <label className="block text-sm">
              <span className="label">Review note (internal)</span>
              <textarea className="field mt-1 min-h-[80px]" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              {a.status !== 'in_review' && (
                <Button variant="outline" size="sm" loading={update.isPending && update.variables === 'in_review'} onClick={() => update.mutate('in_review')}>
                  Mark in review
                </Button>
              )}
              {a.status !== 'approved' && (
                <Button size="sm" loading={update.isPending && update.variables === 'approved'} onClick={() => update.mutate('approved')}>
                  Approve
                </Button>
              )}
              {a.status !== 'rejected' && (
                <Button variant="destructive" size="sm" loading={update.isPending && update.variables === 'rejected'} onClick={() => update.mutate('rejected')}>
                  Reject
                </Button>
              )}
            </div>
            <p className="text-xs text-muted">
              Approving records the decision. Publish the listing (and mark it “Verified by AI Bajan” once checked) from the listing page.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function ApplicationsPage() {
  const [filter, setFilter] = useState('open');
  const q = useApiQuery('applications', getApplications);
  const items = (q.data ?? []).filter((a) => (filter === 'open' ? a.status === 'new' || a.status === 'in_review' : filter === 'all' || a.status === filter));
  return (
    <>
      <PageHeader title="Business & contributor applications" description="Sign-ups submitted from the public “List your business” page. Business sign-ups also create a pending listing." />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Filter applications">
        {[
          ['open', 'Open'],
          ['approved', 'Approved'],
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
            <ApplicationCard key={a.id} a={a} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="No applications here"
            description={IS_LIVE ? 'New sign-ups from the public website appear here.' : 'Applications are only available when connected to the live API.'}
          />
        </Card>
      )}
    </>
  );
}
