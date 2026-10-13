import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { categories } from '@/data/categories';
import { routes } from '@/lib/routes';
import { useAllBusinesses } from '@/hooks/useBusinesses';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Icon } from '@/components/common/Icon';
import { SectionHeading } from '@/components/common/SectionHeading';
import { staggerContainer, staggerItem } from '@/lib/motion';

/**
 * "Explore the Island Your Way". Listing counts come from the actual dataset and only appear
 * once it has loaded. Mobile: horizontal snap-scroll; tablet+: grid.
 */
export function CategoryGrid() {
  const { data } = useAllBusinesses();
  const counts = useMemo(() => {
    if (!data) return null;
    const c = {};
    for (const b of data)
      for (const slug of b.categories ?? [b.category]) c[slug] = (c[slug] ?? 0) + 1;
    return c;
  }, [data]);

  return (
    <section aria-labelledby="categories-heading" className="section-y">
      <div className="container-page">
        <SectionHeading
          id="categories-heading"
          eyebrow="Start exploring"
          title="Explore the Island Your Way"
          description="From fish fry to spa day — pick a starting point and we’ll show you what’s listed across Barbados."
          action={{ label: 'All businesses', to: routes.businesses() }}
        />
      </div>
      <motion.ul
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
        className="container-page scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4 lg:gap-5"
      >
        {categories.map((c) => (
          <motion.li
            key={c.slug}
            variants={staggerItem}
            className="w-[78%] shrink-0 snap-start sm:w-auto"
          >
            <Link
              to={routes.category(c.slug)}
              className="img-zoom group relative flex aspect-[4/5] h-full flex-col overflow-hidden rounded-card bg-navy shadow-card sm:aspect-[4/3] lg:aspect-[3/4]"
            >
              <ImageWithFallback
                imageKey={c.image}
                decorative
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 80vw"
                className="absolute inset-0"
              />
              <span
                className="absolute inset-0 bg-gradient-to-t from-navy-900/90 via-navy-900/30 to-transparent"
                aria-hidden="true"
              />
              <span className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-2xl bg-white/90 text-ocean-700 shadow-soft backdrop-blur transition-colors group-hover:bg-coral group-hover:text-navy-900">
                <Icon name={c.icon} className="h-5 w-5" />
              </span>
              <span className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/0 text-white opacity-0 ring-1 ring-white/60 transition-all duration-300 group-hover:opacity-100">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="relative mt-auto p-5">
                {counts && (counts[c.slug] ?? 0) > 0 && (
                  <span className="mb-2 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold text-white ring-1 ring-white/30 backdrop-blur">
                    {counts[c.slug]} {counts[c.slug] === 1 ? 'listing' : 'listings'}
                  </span>
                )}
                <span className="block text-xl font-extrabold leading-tight text-white">
                  {c.name}
                </span>
                <span className="mt-1.5 block text-sm leading-snug text-white/80">
                  {c.description}
                </span>
              </span>
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}
