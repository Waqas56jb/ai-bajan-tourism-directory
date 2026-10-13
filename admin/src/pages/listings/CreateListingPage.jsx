import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiMutation, useApiQuery } from '@/hooks/useApi';
import { createListing } from '@/services/listingService';
import { getGeneralSettings } from '@/services/settingsService';
import { PageHeader } from '@/components/layout/PageHeader';
import { ListingForm } from '@/components/listings/ListingForm';
import { emptyListing } from '@/components/listings/listingSchema';
import { PageLoading } from '@/components/common/States';
import { useLookups } from '@/hooks/useLookups';

export default function CreateListingPage() {
  const navigate = useNavigate();
  const settings = useApiQuery('generalSettings', getGeneralSettings);
  const lookups = useLookups();
  const create = useApiMutation(createListing, {
    invalidate: [['listings'], ['categories'], ['locations'], ['syncJobs']],
    success: (l) => `Listing “${l.name}” created as ${l.status}`,
    error: 'Couldn’t create the listing',
  });

  const initialValues = useMemo(
    () =>
      settings.data
        ? emptyListing({
            status: settings.data.defaultListingStatus,
            includeInChatbot: settings.data.defaultChatbotVisibility,
            searchVisible: settings.data.defaultSeoVisibility,
            featured: settings.data.defaultFeatured,
          })
        : null,
    [settings.data],
  );

  return (
    <>
      <PageHeader
        title="Add listing"
        description="Create a new directory listing. Required fields are marked with an asterisk."
      />
      {!initialValues || lookups.isLoading ? (
        <PageLoading />
      ) : (
        <ListingForm
          mode="create"
          initialValues={initialValues}
          submitting={create.isPending}
          onCancel={() => navigate('/listings')}
          onSubmit={async (values) => {
            try {
              const listing = await create.mutateAsync(values);
              navigate(`/listings/${listing.id}`);
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
