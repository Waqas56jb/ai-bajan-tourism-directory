import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { experiences } from '@/data/experiences';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { SectionHeading } from '@/components/common/SectionHeading';
import { Reveal } from '@/components/common/Reveal';

/** Bento-style editorial mosaic on a dark background — deliberately unlike the category grid. */
const layout = [
  'lg:col-span-7 lg:row-span-2 aspect-[4/5] sm:aspect-[16/11] lg:aspect-auto',
  'lg:col-span-5 aspect-[16/10]',
  'lg:col-span-5 aspect-[16/10]',
  'lg:col-span-4 aspect-[4/5] sm:aspect-[16/11] lg:aspect-[4/5]',
  'lg:col-span-4 aspect-[4/5] sm:aspect-[16/11] lg:aspect-[4/5]',
  'sm:col-span-2 lg:col-span-4 aspect-[4/5] sm:aspect-[21/9] lg:aspect-[4/5]',
];

export function ExperiencesSection() {
  return (
    <section
      aria-labelledby="experiences-heading"
      className="section-y relative overflow-hidden bg-navy text-white"
    >
      <div
        className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-ocean/20 blur-3xl"
        aria-hidden="true"
      />
      <div className="container-page relative">
        <SectionHeading
          id="experiences-heading"
          tone="light"
          eyebrow="Experience Barbados"
          title={
            <>
              Days you’ll talk about <em className="italic text-lagoon">long after</em> the tan
              fades.
            </>
          }
          description="Six ways into island life — each one leads to real listings, places and guides."
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:gap-5">
          {experiences.map((e, i) => (
            <Reveal
              as="li"
              key={e.id}
              delay={(i % 3) * 0.08}
              className={`${layout[i]} ${i === 0 ? 'sm:col-span-2 lg:col-span-7' : ''}`}
            >
              <Link
                to={e.to}
                className="img-zoom group relative block h-full overflow-hidden rounded-card"
              >
                <ImageWithFallback
                  imageKey={e.image}
                  decorative
                  className="absolute inset-0"
                  sizes={
                    i === 0
                      ? '(min-width: 1024px) 58vw, 100vw'
                      : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
                  }
                />
                <span
                  className="absolute inset-0 bg-gradient-to-t from-navy-900/95 via-navy-900/25 to-transparent"
                  aria-hidden="true"
                />
                <span className="absolute left-5 top-5 font-display text-lg text-white/80">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="absolute inset-x-0 bottom-0 p-6 md:p-7">
                  <span
                    className={`block font-display leading-tight text-white ${i === 0 ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl'}`}
                  >
                    {e.title}
                  </span>
                  <span
                    className={`mt-2 block max-w-md text-white/80 ${i === 0 ? 'text-lead' : 'text-sm'}`}
                  >
                    {e.text}
                  </span>
                  <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/30 backdrop-blur transition-colors group-hover:bg-coral group-hover:text-navy-900 group-hover:ring-coral">
                    {e.cta}
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
