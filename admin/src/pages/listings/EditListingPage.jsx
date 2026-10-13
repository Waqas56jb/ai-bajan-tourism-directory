import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { useApiMutation, useApiQuery } from '@/hooks/useApi';
import { getListingById, updateListing } from '@/services/listingService';
import { usePageTitle } from '@/context/PageMetaContext';
import { useLookups } from '@/hooks/useLookups';
import { PageHeader } from '@/components/layout/PageHeader';
import { ListingForm } from '@/components/listings/ListingForm';
import { listingToForm } from '@/components/listings/listingSchema';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { ErrorState, PageLoading } from '@/components/common/States';
import NotFoundPage from '@/pages/errors/NotFoundPage';

export default function EditListingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const lookups = useLookups();
  const {
    data: listing,
    isPending,
    isError,
    error,
    refetch,
  } = useApiQuery(['listing', id], () => getListingById(id));
  usePageTitle(listing?.name);
  const update = useApiMutation((values) => updateListing(id, values), {
    invalidate: [['listings'], ['listing'], ['categories'], ['locations'], ['syncJobs']],
    success: (l) => `Saved “${l.name}”`,
    error: 'Couldn’t save changes',
  });
  const initialValues = useMemo(() => (listing ? listingToForm(listing) : null), [listing]);

  if (isError && error?.status === 404)
    return (
      <NotFoundPage
        title="Listing not found"
        message="This listing may have been deleted."
        backTo="/listings"
        backLabel="Back to listings"
      />
    );

  return (
    <>
      <PageHeader
        title={listing ? `Edit ${listing.name}` : 'Edit listing'}
        setTitle={false}
        description="Update listing details. Unsaved changes trigger a warning if you leave."
        actions={
          listing && (
            <Button variant="outline" icon={Eye} to={`/listings/${id}/preview`}>
              Preview
            </Button>
          )
        }
      />
      {isError ? (
        <Card>
          <ErrorState message={error?.message} onRetry={refetch} />
        </Card>
      ) : isPending || lookups.isLoading ? (
        <PageLoading />
      ) : (
        <ListingForm
          key={listing.id}
          mode="edit"
          listingId={id}
          initialValues={initialValues}
          submitting={update.isPending}
          onCancel={() => navigate(`/listings/${id}`)}
          onSubmit={async (values) => {
            try {
              await update.mutateAsync(values);
              navigate(`/listings/${id}`);
              return true;
            } catch {
              return false;
            }
          }}
        />
      )}
    </>
  );
}
