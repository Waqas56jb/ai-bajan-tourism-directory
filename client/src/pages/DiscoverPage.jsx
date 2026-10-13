import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { destinations } from '@/data/destinations';
import { experiences } from '@/data/experiences';
import { routes } from '@/lib/routes';
import { Seo } from '@/lib/seo';
import { PageHero } from '@/components/layout/PageContainer';
import { SectionHeading } from '@/components/common/SectionHeading';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Button } from '@/components/common/Button';
import { Reveal } from '@/components/common/Reveal';

/** Themed chapters, each linking to real directory filters, places or guides. */
const chapters = [
  {
    id: 'west-coast',
    eyebrow: 'West Coast',
    title: 'Calm water and golden evenings',
    text: 'The sheltered Caribbean side is made for swimming, sailing and sunset dinners. Holetown and Speightstown anchor a coast of quiet beaches and easy days.',
    image: 'holetownAerial',
    links: [
      { label: 'Explore Holetown', to: routes.destination('holetown') },
      { label: 'Explore Speightstown', to: routes.destination('speightstown') },
      { label: 'West coast guide', to: routes.guide('exploring-the-west-coast') },
    ],
  },
  {
    id: 'south-coast',
    eyebrow: 'South Coast',
    title: 'Lively beaches, fish fry and nightlife',
    text: 'Christ Church brings boardwalk mornings in Hastings, dinners in St. Lawrence Gap and the sociable fish fry at Oistins.',
    image: 'coastlineAerial',
    links: [
      { label: 'Explore Christ Church', to: routes.destination('christ-church') },
      { label: 'Explore Oistins', to: routes.destination('oistins') },
      {
        label: 'Restaurants on the south coast',
        to: routes.businesses({ category: 'restaurants', location: 'Christ Church' }),
      },
    ],
  },
  {
    id: 'east-coast',
    eyebrow: 'East Coast',
    title: 'Where the Atlantic takes over',
    text: 'Bathsheba’s boulders and rolling surf feel a world away from the west. Come for the views and the surf culture — and take currents seriously.',
    image: 'barbadosSurfRocks',
    links: [
      { label: 'Explore Bathsheba', to: routes.destination('bathsheba') },
      {
        label: 'Stays on the east coast',
        to: routes.businesses({ category: 'hotels', location: 'Saint Joseph' }),
      },
    ],
  },
  {
    id: 'culture',
    eyebrow: 'Culture & heritage',
    title: 'A capital with World Heritage streets',
    text: 'Historic Bridgetown and its Garrison are UNESCO-listed. Add music, rum heritage and craft makers and you have days of discovery away from the sand.',
    image: 'colourfulStreet',
    links: [
      { label: 'Explore Bridgetown', to: routes.destination('bridgetown') },
      { label: 'Culture & heritage listings', to: routes.category('culture') },
      {
        label: 'Beyond the beaches guide',
        to: routes.guide('discovering-barbados-beyond-the-beaches'),
      },
    ],
  },
  {
    id: 'nature',
    eyebrow: 'Nature & wildlife',
    title: 'Gardens, gullies and green monkeys',
    text: 'The island’s interior is lush and surprising — tropical gardens, shaded gullies and wildlife, including Barbados’ green monkeys.',
    image: 'huntesGardensSky',
    links: [
      { label: 'Attractions', to: routes.category('attractions') },
      { label: 'Guided hikes', to: routes.businesses({ q: 'hiking' }) },
    ],
  },
  {
    id: 'food',
    eyebrow: 'Food & markets',
    title: 'Eat like you live here',
    text: 'Flying fish and cou-cou, fish cakes, macaroni pie and fiery pepper sauce — plus markets piled with tropical fruit.',
    image: 'fruitStall',
    links: [
      { label: 'Bajan food guide', to: routes.guide('where-to-experience-local-bajan-food') },
      { label: 'Local markets', to: routes.businesses({ q: 'market', category: 'shopping' }) },
    ],
  },
  {
    id: 'family',
    eyebrow: 'Family-friendly',
    title: 'Easy wins for every age',
    text: 'Calm beaches, gentle water sports and hands-on attractions. Filter the directory by “Family-friendly” to see what’s listed.',
    image: 'snorkelSelfie',
    links: [
      {
        label: 'Family-friendly listings',
        to: routes.businesses({ amenities: 'family-friendly' }),
      },
    ],
  },
];

export default function DiscoverPage() {
  return (
    <>
      <Seo
        title="Discover Barbados"
        description="Explore Barbados by coast, culture, nature and food — with links to real listings, places and travel guides."
        path="/discover"
        imageKey="holetownAerial"
      />
      <PageHero
        imageKey="turquoiseReefAerial"
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Discover' }]}
        eyebrow="Discover the island"
        title="One island, many moods."
        description="Barbados is only about 34 km long, yet its coasts feel completely different. Start with a mood — calm, lively, wild or cultural — and follow it."
        size="lg"
      >
        <div className="flex flex-wrap gap-2">
          {chapters.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white hover:text-navy"
            >
              {c.eyebrow}
            </a>
          ))}
        </div>
      </PageHero>

      <div className="container-page section-y space-y-20 md:space-y-28">
        {chapters.map((c, i) => (
          <section key={c.id} id={c.id} aria-labelledby={`${c.id}-title`} className="scroll-mt-28">
            <div
              className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${i % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}
            >
              <Reveal>
                <div className="img-zoom overflow-hidden rounded-card shadow-card">
                  <ImageWithFallback
                    imageKey={c.image}
                    aspect={i % 3 === 0 ? 'aspect-[4/3]' : 'aspect-[16/11]'}
                    sizes="(min-width: 1024px) 50vw, 100vw"
                  />
                </div>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="eyebrow mb-4">{c.eyebrow}</p>
                <h2
                  id={`${c.id}-title`}
                  className="font-display text-section font-normal text-balance"
                >
                  {c.title}
                </h2>
                <p className="mt-5 text-lead text-muted">{c.text}</p>
                <ul className="mt-7 flex flex-wrap gap-2.5">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        to={l.to}
                        className="group inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-navy shadow-soft ring-1 ring-line transition-colors hover:bg-navy hover:text-white"
                      >
                        {l.label}
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </section>
        ))}
      </div>

      {/* Experiences strip */}
      <section aria-labelledby="discover-exp" className="bg-navy py-20 text-white md:py-28">
        <div className="container-page">
          <SectionHeading
            id="discover-exp"
            tone="light"
            eyebrow="Beaches & water"
            title="Get out on the water"
          />
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {experiences.slice(0, 6).map((e) => (
              <li key={e.id}>
                <Link
                  to={e.to}
                  className="img-zoom group relative block overflow-hidden rounded-card"
                >
                  <ImageWithFallback
                    imageKey={e.image}
                    decorative
                    aspect="aspect-[4/3]"
                    sizes="(min-width: 1024px) 33vw, 50vw"
                  />
                  <span
                    className="absolute inset-0 bg-gradient-to-t from-navy-900/90 to-transparent"
                    aria-hidden="true"
                  />
                  <span className="absolute inset-x-0 bottom-0 p-5">
                    <span className="block font-display text-2xl text-white">{e.title}</span>
                    <span className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-lagoon">
                      {e.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="discover-places" className="container-page section-y">
        <SectionHeading id="discover-places" eyebrow="Places" title="Choose your base" />
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {destinations.map((d) => (
            <li key={d.slug}>
              <Link
                to={routes.destination(d.slug)}
                className="img-zoom group relative block overflow-hidden rounded-card"
              >
                <ImageWithFallback
                  imageKey={d.image}
                  decorative
                  aspect="aspect-square"
                  sizes="(min-width: 768px) 25vw, 50vw"
                />
                <span
                  className="absolute inset-0 bg-gradient-to-t from-navy-900/85 to-transparent"
                  aria-hidden="true"
                />
                <span className="absolute bottom-0 p-4 font-display text-xl text-white md:text-2xl">
                  {d.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-12 text-center">
          <Button to={routes.businesses()} size="lg">
            Explore all businesses
          </Button>
        </div>
      </section>
    </>
  );
}
