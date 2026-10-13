import { Bot, Compass, HeartHandshake, MapPinned, Search, ShieldCheck } from 'lucide-react';
import { getImageCredits, PEXELS_LICENSE_URL } from '@/lib/imageSources';
import { routes } from '@/lib/routes';
import { Seo } from '@/lib/seo';
import { PageHero } from '@/components/layout/PageContainer';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { SectionHeading } from '@/components/common/SectionHeading';
import { Button } from '@/components/common/Button';
import { Reveal } from '@/components/common/Reveal';

const pillars = [
  {
    icon: Search,
    title: 'Find it fast',
    text: 'Search by what you want and where you are, across every parish.',
  },
  {
    icon: HeartHandshake,
    title: 'Go local',
    text: 'Independent guesthouses, kitchens and makers sit alongside well-known names.',
  },
  {
    icon: Bot,
    title: 'Ask, don’t scroll',
    text: 'The AI Bajan assistant searches the directory for you in plain language.',
  },
  {
    icon: ShieldCheck,
    title: 'Honest by design',
    text: 'Paid placements are always labelled, and the assistant says when it doesn’t know.',
  },
];

export default function AboutPage() {
  const credits = getImageCredits();
  return (
    <>
      <Seo
        title="About AI Bajan"
        description="AI Bajan is a modern digital guide to Barbados, combining local business discovery with an AI travel assistant."
        path="/about"
        imageKey="huntesGardens"
      />
      <PageHero
        imageKey="huntesGardens"
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'About' }]}
        eyebrow="About AI Bajan"
        title="Discover Barbados. Find local gems. Experience the island with confidence."
        size="md"
      />

      <section
        aria-labelledby="about-intro"
        className="container-page section-y grid gap-12 lg:grid-cols-2 lg:gap-20"
      >
        <Reveal>
          <p className="eyebrow mb-4">Who we are</p>
          <h2 id="about-intro" className="font-display text-section font-normal text-balance">
            A modern guide to the island — built around the people who make it.
          </h2>
        </Reveal>
        <Reveal delay={0.08} className="space-y-5 text-lead text-ink/80">
          <p>
            AI Bajan is a digital guide to Barbados that brings together a searchable directory of
            local businesses and an intelligent travel assistant. It is designed for visitors,
            residents and travel planners who want to spend less time searching and more time
            enjoying the island.
          </p>
          <p>
            <strong className="text-navy">Our mission</strong> is to make it easy to discover the
            restaurants, stays, experiences and services across Barbados — especially the
            independent businesses that are easy to miss.
          </p>
          <p>
            <strong className="text-navy">Our vision</strong> is a guide that feels local, stays
            honest about what it knows, and helps more of every trip’s spending reach Barbadian
            businesses.
          </p>
        </Reveal>
      </section>

      <section aria-labelledby="about-how" className="bg-sand py-16 md:py-24">
        <div className="container-page">
          <SectionHeading
            id="about-how"
            eyebrow="How it helps"
            title="How the directory works for visitors"
            align="center"
          />
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map(({ icon: I, title, text }, i) => (
              <Reveal
                as="li"
                key={title}
                delay={i * 0.06}
                className="rounded-card bg-white p-6 shadow-soft"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ocean/10 text-ocean-700">
                  <I className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
                <p className="mt-2 text-muted">{text}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section
        aria-labelledby="about-ai"
        className="container-page section-y grid items-center gap-12 lg:grid-cols-2 lg:gap-20"
      >
        <Reveal className="grid grid-cols-2 gap-4">
          <ImageWithFallback
            imageKey="holetownAerial"
            aspect="aspect-[3/4]"
            className="rounded-card shadow-card"
            sizes="25vw"
          />
          <ImageWithFallback
            imageKey="barbadosSurfRocks"
            aspect="aspect-[3/4]"
            className="mt-12 rounded-card shadow-card"
            sizes="25vw"
          />
        </Reveal>
        <Reveal delay={0.08}>
          <p className="eyebrow mb-4">The AI assistant</p>
          <h2 id="about-ai" className="font-display text-section font-normal">
            Answers grounded in the directory
          </h2>
          <p className="mt-5 text-lead text-ink/80">
            The AI Bajan assistant is designed to answer from the directory and approved travel
            information — not from guesswork. Ask for “restaurants in Holetown” and it looks for
            restaurant listings in Holetown, rather than padding the answer with unrelated places.
          </p>
          <p className="mt-4 text-ink/80">
            It doesn’t know live opening hours, availability or prices unless a business has
            supplied them, and it will tell you when information isn’t available. In this preview,
            the assistant runs in a clearly labelled demo mode using sample listings.
          </p>
          <ul className="mt-6 space-y-2 text-ink/80">
            <li className="flex gap-2">
              <Compass className="mt-1 h-4 w-4 shrink-0 text-ocean-700" aria-hidden="true" />{' '}
              Searches by category and area
            </li>
            <li className="flex gap-2">
              <MapPinned className="mt-1 h-4 w-4 shrink-0 text-ocean-700" aria-hidden="true" />{' '}
              Links straight to listings and guides as sources
            </li>
          </ul>
        </Reveal>
      </section>

      <section aria-labelledby="about-owners" className="container-page pb-20">
        <div className="rounded-[2rem] bg-navy p-8 text-white md:p-14">
          <div className="max-w-2xl">
            <p className="eyebrow eyebrow-light mb-4">For business owners</p>
            <h2 id="about-owners" className="font-display text-section font-normal text-white">
              Want travellers to find your business?
            </h2>
            <p className="mt-4 text-lead text-white/80">
              Tell us about your business and we’ll follow up about listing and advertising options.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to={routes.contact('listing')} variant="coral" size="lg">
                Request a listing
              </Button>
              <Button to={routes.contact('advertising')} variant="glass" size="lg">
                Advertising enquiries
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section
        id="photo-credits"
        aria-labelledby="credits-heading"
        className="scroll-mt-28 border-t border-line bg-white py-16"
      >
        <div className="container-page">
          <h2 id="credits-heading" className="text-2xl font-extrabold">
            Photo credits
          </h2>
          <p className="mt-3 max-w-3xl text-muted">
            Photos are from{' '}
            <a
              href="https://www.pexels.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-ocean-700 underline"
            >
              Pexels
            </a>{' '}
            and used under the{' '}
            <a
              href={PEXELS_LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-ocean-700 underline"
            >
              Pexels License
            </a>
            . Photos marked “Barbados” are tagged with a Barbados location by their source; others
            are illustrative Caribbean and tropical scenes.
          </p>
          <ul className="mt-8 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {credits.map((c) => (
              <li
                key={c.key}
                className="flex items-baseline justify-between gap-3 border-b border-line py-2"
              >
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate font-semibold text-navy hover:text-ocean-700"
                >
                  {c.credit}
                </a>
                <span className="shrink-0 text-xs text-muted">
                  {c.isBarbados ? c.location : 'Illustrative'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
