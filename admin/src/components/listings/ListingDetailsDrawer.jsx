import { CheckCircle2, ExternalLink, MessageSquareWarning, XCircle } from 'lucide-react';
import { Drawer } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { ImageWithFallback } from '@/components/common/ImageUploadPreview';
import { Avatar } from '@/components/common/Avatar';
import { formatDateTime } from '@/utils/formatDate';
import { ListingStatusBadge } from './ListingStatusBadge';

/** Review panel for a submitted listing. */
export function ListingDetailsDrawer({
  listing,
  open,
  onOpenChange,
  submitter,
  categoryName,
  placeLabel,
  actions,
}) {
  if (!listing) return null;
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={listing.name}
      description={`Submitted ${formatDateTime(listing.submittedAt)}`}
      footer={
        listing.status === 'pending' ? (
          <>
            <Button variant="destructive-outline" icon={XCircle} onClick={() => actions.reject(listing)}>
              Reject
            </Button>
            <Button
              variant="outline"
              icon={MessageSquareWarning}
              onClick={() => actions.requestChanges(listing)}
            >
              Request changes
            </Button>
            <Button variant="accent" icon={CheckCircle2} onClick={() => actions.approve(listing)}>
              Approve
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted">
            This submission is now <ListingStatusBadge status={listing.status} />
          </p>
        )
      }
    >
      <ImageWithFallback
        src={listing.media.featuredImage}
        alt={listing.media.featuredAlt}
        className="aspect-[16/9] rounded-xl"
      />
      <div className="mt-5 space-y-5 text-sm">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Submitted by</h3>
          {submitter ? (
            <div className="mt-2 flex items-center gap-3">
              <Avatar name={submitter.name} size="sm" />
              <div>
                <p className="font-medium">{submitter.name}</p>
                <p className="text-xs text-muted">{submitter.email}</p>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-muted">Unknown submitter</p>
          )}
        </section>
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Business</h3>
          <dl className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-muted">Category</dt>
              <dd>{categoryName(listing.categoryId)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Location</dt>
              <dd>{placeLabel(listing.location)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Phone</dt>
              <dd>{listing.contact.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Email</dt>
              <dd className="break-all">{listing.contact.email || '—'}</dd>
            </div>
          </dl>
        </section>
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Description</h3>
          <p className="mt-1 font-medium">{listing.shortDescription}</p>
          <p className="mt-1 text-muted">{listing.description}</p>
        </section>
        {listing.internalNotes && (
          <section className="rounded-xl border border-sand/50 bg-sand/10 p-3">
            <h3 className="text-xs font-semibold text-sand-600">Internal note (admins only)</h3>
            <p className="mt-1">{listing.internalNotes}</p>
          </section>
        )}
        <Button variant="ghost" size="sm" icon={ExternalLink} to={`/listings/${listing.id}`}>
          Open full listing
        </Button>
      </div>
    </Drawer>
  );
}
