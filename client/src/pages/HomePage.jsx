import { Seo } from '@/lib/seo';
import { websiteJsonLd } from '@/lib/structuredData';
import { HeroSection } from '@/components/home/HeroSection';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { FeaturedBusinesses } from '@/components/home/FeaturedBusinesses';
import { PopularDestinations } from '@/components/home/PopularDestinations';
import { ExperiencesSection } from '@/components/home/ExperiencesSection';
import { LocalGems } from '@/components/home/LocalGems';
import { AITravelAssistantSection } from '@/components/home/AITravelAssistantSection';
import { SponsoredBusinesses } from '@/components/home/SponsoredBusinesses';
import { TourismGuides } from '@/components/home/TourismGuides';
import { BusinessOwnerCTA } from '@/components/home/BusinessOwnerCTA';
import { NewsletterSection } from '@/components/home/NewsletterSection';

export default function HomePage() {
  return (
    <>
      <Seo
        path="/"
        description="Discover the restaurants, stays, experiences and local gems that make Barbados unforgettable — and ask the AI Bajan travel assistant."
        jsonLd={websiteJsonLd()}
      />
      <HeroSection />
      <CategoryGrid />
      <FeaturedBusinesses />
      <PopularDestinations />
      <ExperiencesSection />
      <LocalGems />
      <AITravelAssistantSection />
      <SponsoredBusinesses />
      <TourismGuides />
      <BusinessOwnerCTA />
      <NewsletterSection />
    </>
  );
}
