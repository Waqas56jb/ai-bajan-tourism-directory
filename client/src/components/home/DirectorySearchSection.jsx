import { HeroSearch } from './HeroSearch';

/** Secondary homepage section: search the business & places directory (restaurants, stays, tours…). */
export function DirectorySearchSection() {
  return (
    <section aria-labelledby="directory-search-title" className="relative isolate overflow-hidden bg-navy-900 py-16 md:py-20">
      <div
        className="pointer-events-none absolute -left-24 top-0 -z-10 h-72 w-72 rounded-full bg-ocean/30 blur-3xl"
        aria-hidden="true"
      />
      <div className="container-page">
        <p className="eyebrow eyebrow-light mb-3">Directory</p>
        <h2 id="directory-search-title" className="max-w-2xl font-display text-3xl text-white md:text-4xl">
          Find places and businesses across Barbados
        </h2>
        <p className="mt-3 max-w-2xl text-white/75">
          Restaurants, places to stay, tours, shops and local services — for people who live here
          and for visitors alike.
        </p>
        <div className="mt-8 max-w-5xl">
          <HeroSearch />
        </div>
      </div>
    </section>
  );
}
