import { useSearchParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Seo } from '@/lib/seo';
import { breadcrumbJsonLd } from '@/lib/structuredData';
import { categoryBySlug } from '@/data/categories';
import { IS_DEMO } from '@/lib/config';
import { PageHeader } from '@/components/layout/PageContainer';
import { DirectoryExplorer } from '@/components/directory/DirectoryExplorer';
import { DemoNotice } from '@/components/common/DemoNotice';

export default function DirectoryPage() {
  const [params] = useSearchParams();
  const category = categoryBySlug[params.get('category')];
  const location = params.get('location');
  const crumbs = [{ label: 'Home', to: '/' }, { label: 'Businesses' }];

  const titleBits = [category?.name, location && `in ${location}`].filter(Boolean).join(' ');

  return (
    <>
      <Seo
        title={titleBits ? `${titleBits} — Barbados directory` : 'Explore Barbados Businesses'}
        description="Search restaurants, stays, tours, attractions, shops, transport and wellness businesses across Barbados by category and area."
        path="/businesses"
        jsonLd={breadcrumbJsonLd(crumbs)}
      />
      <PageHeader
        breadcrumbs={crumbs}
        eyebrow="Business directory"
        title="Explore Barbados Businesses"
        description="Search by name, keyword or place, then narrow by category, parish and amenities. Every search has its own link — bookmark it or share it."
      >
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy shadow-soft">
            <MapPin className="h-4 w-4 text-coral-600" aria-hidden="true" />
            {location ? `Showing: ${location}` : 'Showing: all of Barbados'}
          </p>
        </div>
        {IS_DEMO && (
          <DemoNotice className="mt-5 max-w-3xl">
            Preview mode: listings are fictional demo businesses that show how the directory works.
            They are labelled “Demo”.
          </DemoNotice>
        )}
      </PageHeader>
      <div className="container-page pb-24">
        <DirectoryExplorer />
      </div>
    </>
  );
}
