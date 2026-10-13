import { useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useApiQuery } from '@/hooks/useApi';
import { getListingById } from '@/services/listingService';
import { useLookups } from '@/hooks/useLookups';
import { usePageTitle } from '@/context/PageMetaContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { DemoNotice, ErrorState, PageLoading } from '@/components/common/States';
import { ListingPreview } from '@/components/listings/ListingPreview';
import { ListingStatusBadge } from '@/components/listings/ListingStatusBadge';
import NotFoundPage from '@/pages/errors/NotFoundPage';

export default function ListingPreviewPage() {
  const { id } = useParams();
  const lookups = useLookups();
  const {
    data: listing,
    isPending,
    isError,
    error,
    refetch,
  } = useApiQuery(['listing', id], () => getListingById(id));
  usePageTitle(listing?.name);

  if (isError && error?.status === 404)
    return <NotFoundPage title="Listing not found" backTo="/listings" backLabel="Back to listings" />;

  return (
    <>
      <PageHeader
        title="Listing preview"
        setTitle={false}
        description="How this listing would appear on the public AI Bajan website."
        badge={listing && <ListingStatusBadge status={listing.status} />}
        actions={
          <>
            <Button variant="outline" icon={ArrowLeft} to={`/listings/${id}`}>
              Back to details
            </Button>
            <Button icon={Pencil} to={`/listings/${id}/edit`}>
              Edit
            </Button>
          </>
        }
      />
      <DemoNotice className="mb-5" title="Frontend preview">
        An approximation of the public page rendered from the current demo data. Internal notes and admin
        metadata are never shown.
        {listing &&
          listing.status !== 'published' &&
          ' This listing is not published, so visitors can’t see it yet.'}
      </DemoNotice>
      {isError ? (
        <Card>
          <ErrorState message={error?.message} onRetry={refetch} />
        </Card>
      ) : isPending || lookups.isLoading ? (
        <PageLoading />
      ) : (
        <ListingPreview
          listing={listing}
          categoryName={lookups.categoryName}
          placeLabel={lookups.placeLabel}
        />
      )}
    </>
  );
}
