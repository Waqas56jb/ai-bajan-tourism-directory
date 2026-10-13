import { Seo } from '@/lib/seo';
import { websiteJsonLd } from '@/lib/structuredData';
import { HeroSection } from '@/components/home/HeroSection';
import { DirectorySearchSection } from '@/components/home/DirectorySearchSection';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { FeaturedBusinesses } from '@/components/home/FeaturedBusinesses';
import { PopularDestinations } from '@/components/home/PopularDestinations';
import { ExperiencesSection } from '@/components/home/ExperiencesSection';
import { LocalGems } from '@/components/home/LocalGems';
import { SponsoredBusinesses } from '@/components/home/SponsoredBusinesses';
import { TourismGuides } from '@/components/home/TourismGuides';
import { BusinessOwnerCTA } from '@/components/home/BusinessOwnerCTA';
import { NewsletterSection } from '@/components/home/NewsletterSection';

/**
 * AI Bajan is first a Barbados knowledge assistant: the question box leads the page. The business
 * and places directory is a secondary section further down.
 */
export default function HomePage() {
  return (
    <>
      <Seo
        path="/"
        description="Ask Barbados. Get a Bajan answer. AI Bajan answers questions about Barbados — history, culture, food, people, places, businesses, government services and everyday life — with reliable Barbadian sources."
        jsonLd={websiteJsonLd()}
      />
      <HeroSection />
      <TourismGuides />
      <DirectorySearchSection />
      <CategoryGrid />
      <FeaturedBusinesses />
      <PopularDestinations />
      <ExperiencesSection />
      <LocalGems />
      <SponsoredBusinesses />
      <BusinessOwnerCTA />
      <NewsletterSection />
    </>
  );
}
