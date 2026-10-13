import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  Globe,
  Lock,
  Mail,
  MessageCircle,
  MoreHorizontal,
  MousePointerClick,
  Pencil,
  Phone,
  Send,
  XCircle,
} from 'lucide-react';
import { useApiQuery } from '@/hooks/useApi';
import { getListingById } from '@/services/listingService';
import { getActivityLogs } from '@/services/activityService';
import { useLookups } from '@/hooks/useLookups';
import { usePageTitle } from '@/context/PageMetaContext';
import { useListingActions } from '@/components/listings/useListingActions';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import { Tabs } from '@/components/common/Tabs';
import { StatusBadge, DemoBadge, Badge } from '@/components/common/Badge';
import { ErrorState, PageLoading, EmptyState } from '@/components/common/States';
import { ImageWithFallback } from '@/components/common/ImageUploadPreview';
import { ListingStatusBadge, FeaturedBadge } from '@/components/listings/ListingStatusBadge';
import { INDEXING_STATUSES } from '@/utils/constants';
import { formatDate, formatDateTime, formatRelative } from '@/utils/formatDate';
import { formatNumber } from '@/utils/formatNumber';
import { safeExternalUrl } from '@/utils/validation';
import { ACTIVITY_ACTIONS } from '@/data/mockActivity';
import NotFoundPage from '@/pages/errors/NotFoundPage';

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink">
        {children || <span className="text-muted">—</span>}
      </dd>
    </div>
  );
}

function ExternalLinkValue({ url }) {
  const safe = safeExternalUrl(url);
  if (!safe) return url ? <span>{url}</span> : null;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-accent-600 hover:underline"
    >
      {safe.replace(/^https?:\/\//, '')} <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}

export default function ListingDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const lookups = useLookups();
  const {
    data: l,
    isPending,
    isError,
    error,
    refetch,
  } = useApiQuery(['listing', id], () => getListingById(id));
  const activity = useApiQuery('activity', getActivityLogs);
  const actions = useListingActions();
  usePageTitle(l?.name);

  if (isError && error?.status === 404)
    return (
      <NotFoundPage
        title="Listing not found"
        message="It may have been deleted."
        backTo="/listings"
        backLabel="Back to listings"
      />
    );
  if (isError)
    return (
      <Card>
        <ErrorState message={error?.message} onRetry={refetch} />
      </Card>
    );
  if (isPending || lookups.isLoading) return <PageLoading />;

  const history = (activity.data ?? []).filter(
    (e) => e.entityId === l.id || e.entityId?.split(',').includes(l.id),
  );
  const primaryActions =
    l.status === 'pending' ? (
      <>
        <Button variant="destructive-outline" icon={XCircle} onClick={() => actions.reject(l)}>
          Reject
        </Button>
        <Button variant="accent" icon={CheckCircle2} onClick={() => actions.approve(l)}>
          Approve
        </Button>
      </>
    ) : l.status === 'published' ? null : l.status !== 'archived' ? (
      <Button variant="accent" icon={Send} onClick={() => actions.publish(l)}>
        Publish
      </Button>
    ) : null;

  const overview = (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Description" />
        <p className="text-sm font-medium text-ink">{l.shortDescription}</p>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{l.description}</p>
        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Primary category">{lookups.categoryName(l.categoryId)}</Field>
          <Field label="Secondary categories">
            {l.secondaryCategoryIds.map(lookups.categoryName).join(', ')}
          </Field>
          <Field label="Listing type">{l.listingType}</Field>
          <Field label="Price range">{l.details.priceRange}</Field>
          <Field label="Languages">{l.details.languages.join(', ')}</Field>
          <Field label="Suitable for">{l.details.audiences.join(', ')}</Field>
          <Field label="Accessibility">{l.details.accessibility}</Field>
          <Field label="Booking requirements">{l.details.bookingRequirements}</Field>
        </dl>
        {l.details.amenities.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-medium text-muted">Amenities</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {l.details.amenities.map((a) => (
                <li key={a}>
                  <Badge>{a}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
        {l.internalNotes && (
          <div className="mt-6 rounded-xl border border-sand/50 bg-sand/10 p-3 text-sm">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-sand-600">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Internal note — admins only
            </p>
            <p className="mt-1 text-ink">{l.internalNotes}</p>
          </div>
        )}
        {(l.rejectionReason || l.reviewFeedback) && (
          <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm">
            <p className="text-xs font-semibold text-danger">
              {l.rejectionReason ? 'Rejection reason' : 'Requested changes'}
            </p>
            <p className="mt-1 text-ink">{l.rejectionReason || l.reviewFeedback}</p>
          </div>
        )}
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Engagement" badge={<DemoBadge>Sample</DemoBadge>} />
          <dl className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-subtle/60 p-3">
              <dt className="flex items-center gap-1 text-xs text-muted">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Views
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular">{formatNumber(l.views)}</dd>
            </div>
            <div className="rounded-xl bg-subtle/60 p-3">
              <dt className="flex items-center gap-1 text-xs text-muted">
                <MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" /> Clicks
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular">{formatNumber(l.clicks)}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Opening hours" />
          {l.details.openingHours.length ? (
            <dl className="space-y-1.5 text-sm">
              {l.details.openingHours.map((h) => (
                <div key={h.day} className="flex justify-between gap-3">
                  <dt className="text-muted">{h.day}</dt>
                  <dd className="font-medium">{h.hours}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted">
              No opening hours provided. The chatbot will say hours aren’t available.
            </p>
          )}
        </Card>
        <Card>
          <CardHeader title="Record" />
          <dl className="space-y-3">
            <Field label="Created">{formatDateTime(l.createdAt)}</Field>
            <Field label="Last updated">{formatDateTime(l.updatedAt)}</Field>
            <Field label="Featured">{l.featured ? 'Yes' : 'No'}</Field>
            <Field label="Listing ID">
              <code className="text-xs">{l.id}</code>
            </Field>
          </dl>
        </Card>
      </div>
    </div>
  );

  const contact = (
    <Card>
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Phone">
          {l.contact.phone && (
            <a
              href={`tel:${l.contact.phone.replace(/[^\d+]/g, '')}`}
              className="inline-flex items-center gap-1 text-accent-600 hover:underline"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              {l.contact.phone}
            </a>
          )}
        </Field>
        <Field label="Email">
          {l.contact.email && (
            <a
              href={`mailto:${l.contact.email}`}
              className="inline-flex items-center gap-1 text-accent-600 hover:underline"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              {l.contact.email}
            </a>
          )}
        </Field>
        <Field label="Website">
          <ExternalLinkValue url={l.contact.website} />
        </Field>
        <Field label="WhatsApp">{l.contact.whatsapp}</Field>
        <Field label="Booking URL">
          <ExternalLinkValue url={l.contact.bookingUrl} />
        </Field>
        <Field label="Social links">
          {l.contact.socials.length ? (
            <ul className="space-y-1">
              {l.contact.socials.map((s) => (
                <li key={s.url}>
                  {s.platform}: <ExternalLinkValue url={s.url} />
                </li>
              ))}
            </ul>
          ) : null}
        </Field>
        <Field label="Address">
          {[l.location.address, lookups.placeLabel(l.location)].filter(Boolean).join(', ')}
        </Field>
        <Field label="Coordinates">
          {l.location.lat !== null && l.location.lat !== '' ? `${l.location.lat}, ${l.location.lng}` : null}
        </Field>
        <Field label="Public location display">
          {
            { exact: 'Exact address and map pin', area: 'Town / area only', hidden: 'Hidden' }[
              l.location.displayPreference
            ]
          }
        </Field>
      </dl>
    </Card>
  );

  const media = (
    <Card>
      {!l.media.featuredImage && !l.media.gallery.length ? (
        <EmptyState
          title="No images yet"
          action={
            <Button size="sm" to={`/listings/${l.id}/edit#media`}>
              Add images
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {l.media.featuredImage && (
            <li>
              <ImageWithFallback
                src={l.media.featuredImage}
                alt={l.media.featuredAlt}
                className="aspect-[4/3] rounded-xl"
              />
              <p className="mt-1.5 text-xs">
                <Badge tone="accent">Featured image</Badge>{' '}
                <span className="text-muted">{l.media.featuredAlt}</span>
              </p>
            </li>
          )}
          {l.media.gallery.map((g, i) => (
            <li key={`${g.url}-${i}`}>
              <ImageWithFallback src={g.url} alt={g.alt} className="aspect-[4/3] rounded-xl" />
              <p className="mt-1.5 text-xs text-muted">{g.alt || 'No alt text'}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  const seo = (
    <Card>
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="SEO title">{l.seo.title}</Field>
        <Field label="Meta description">{l.seo.description}</Field>
        <Field label="Keywords">{l.seo.keywords.join(', ')}</Field>
        <Field label="Canonical URL">
          <ExternalLinkValue url={l.seo.canonicalUrl} />
        </Field>
        <Field label="Visible in site search">{l.seo.searchVisible ? 'Yes' : 'No'}</Field>
        <Field label="Search-engine indexing">{l.seo.indexing === 'index' ? 'Allowed' : 'noindex'}</Field>
        <Field label="Public URL">/business/{l.slug}</Field>
      </dl>
    </Card>
  );

  const ai = (
    <Card>
      <CardHeader
        title="Chatbot knowledge"
        description="Simulated status — no index exists until the backend is connected."
        badge={<DemoBadge>Simulated</DemoBadge>}
      />
      <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Included in chatbot">{l.ai.includeInChatbot ? 'Yes' : 'No'}</Field>
        <Field label="Public description used">{l.ai.includeDescription ? 'Yes' : 'No'}</Field>
        <Field label="Contact information used">{l.ai.includeContact ? 'Yes' : 'No'}</Field>
        <Field label="Private notes excluded">Always</Field>
        <Field label="Indexing status">
          <StatusBadge status={l.ai.indexingStatus} map={INDEXING_STATUSES} />
        </Field>
        <Field label="Last indexed">
          {l.ai.lastIndexedAt ? formatDateTime(l.ai.lastIndexedAt) : 'Never'}
        </Field>
      </dl>
      {l.status !== 'published' && (
        <p className="mt-4 text-sm text-muted">Only published listings are made available to the chatbot.</p>
      )}
      <Button variant="outline" size="sm" className="mt-5" icon={MessageCircle} to="/knowledge/sync">
        View sync queue
      </Button>
    </Card>
  );

  const activityTab = (
    <Card padded={false}>
      {history.length === 0 ? (
        <EmptyState title="No activity recorded" description="Changes made in this demo will appear here." />
      ) : (
        <ol className="divide-y divide-line">
          {history.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-sm">
              <span>
                <span className="font-medium text-ink">{ACTIVITY_ACTIONS[e.action] ?? e.action}</span>
                <span className="text-muted"> — {e.summary}</span>
              </span>
              <span className="text-xs text-muted">
                {e.actor} · {formatRelative(e.at)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );

  return (
    <>
      <div className="mb-6 overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <ImageWithFallback
            src={l.media.featuredImage}
            alt={l.media.featuredAlt}
            className="aspect-[4/3] w-full shrink-0 rounded-xl sm:w-44"
          />
          <div className="min-w-0 flex-1">
            <PageHeader
              title={l.name}
              setTitle={false}
              badge={
                <>
                  <ListingStatusBadge status={l.status} />
                  {l.featured && <FeaturedBadge />}
                </>
              }
              description={`${lookups.categoryName(l.categoryId)} · ${lookups.placeLabel(l.location)} · Updated ${formatDate(l.updatedAt)}`}
              actions={
                <>
                  {primaryActions}
                  <Button variant="outline" icon={Globe} to={`/listings/${l.id}/preview`}>
                    Preview
                  </Button>
                  <Button icon={Pencil} to={`/listings/${l.id}/edit`}>
                    Edit
                  </Button>
                  <DropdownMenu
                    label="More actions"
                    items={actions
                      .menuFor(l, { includeView: false, onDeleted: () => navigate('/listings') })
                      .filter((i) => i.label !== 'Edit' && i.label !== 'Preview')}
                    trigger={
                      <IconButton
                        label="More actions"
                        icon={MoreHorizontal}
                        variant="outline"
                        tooltip={false}
                      />
                    }
                  />
                </>
              }
            />
          </div>
        </div>
      </div>

      <Tabs
        listLabel="Listing sections"
        tabs={[
          { value: 'overview', label: 'Overview', content: overview },
          { value: 'contact', label: 'Contact', content: contact },
          {
            value: 'media',
            label: 'Media',
            count: (l.media.featuredImage ? 1 : 0) + l.media.gallery.length,
            content: media,
          },
          { value: 'seo', label: 'SEO', content: seo },
          { value: 'ai', label: 'AI knowledge', content: ai },
          { value: 'activity', label: 'Activity', count: history.length, content: activityTab },
        ]}
      />
    </>
  );
}
