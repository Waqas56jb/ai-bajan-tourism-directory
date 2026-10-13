import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, Shapes } from 'lucide-react';
import { categories } from '@/data/categories';
import { areas, parishes } from '@/data/destinations';
import { routes } from '@/lib/routes';

const SEARCH_EXAMPLES = [
  { label: 'Restaurants in Holetown', params: { category: 'restaurants', location: 'Holetown' } },
  {
    label: 'Guesthouses in Christ Church',
    params: { q: 'guesthouse', category: 'hotels', location: 'Christ Church' },
  },
  {
    label: 'Snorkeling tours near Bridgetown',
    params: { q: 'snorkeling', category: 'tours', location: 'Saint Michael' },
  },
  {
    label: 'Local shops in Speightstown',
    params: { category: 'shopping', location: 'Speightstown' },
  },
];

/**
 * Unified search: keyword + category + area. Submits to /businesses with query params.
 * Desktop: one horizontal bar. Mobile: stacked fields.
 */
export function HeroSearch() {
  const navigate = useNavigate();
  const uid = useId();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');

  const submit = (e) => {
    e.preventDefault();
    navigate(routes.businesses({ q: q.trim(), category, location }));
  };

  const fieldWrap = 'relative flex min-h-[3.5rem] items-center gap-3 px-4 md:px-5';
  const labelCls = 'block text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-muted';
  const controlCls =
    'w-full bg-transparent text-[0.98rem] font-semibold text-navy placeholder:font-medium placeholder:text-muted/80 focus:outline-none';

  return (
    <div>
      <form
        role="search"
        aria-label="Search the Barbados directory"
        onSubmit={submit}
        className="grid gap-2 rounded-[1.75rem] bg-white p-2 shadow-lift ring-1 ring-black/5 md:grid-cols-[1.5fr_1fr_1fr_auto] md:gap-0 md:rounded-full"
      >
        <div className={`${fieldWrap} rounded-2xl bg-cream md:rounded-l-full md:bg-transparent`}>
          <Search className="h-5 w-5 shrink-0 text-ocean-700" aria-hidden="true" />
          <div className="min-w-0 flex-1 py-2">
            <label htmlFor={`${uid}-q`} className={labelCls}>
              What are you looking for?
            </label>
            <input
              id={`${uid}-q`}
              type="search"
              enterKeyHint="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Seafood, catamaran, guesthouse…"
              className={`${controlCls} [&::-webkit-search-cancel-button]:appearance-none`}
            />
          </div>
        </div>
        <div
          className={`${fieldWrap} rounded-2xl bg-cream md:rounded-none md:border-l md:border-line md:bg-transparent`}
        >
          <Shapes className="h-5 w-5 shrink-0 text-ocean-700" aria-hidden="true" />
          <div className="min-w-0 flex-1 py-2">
            <label htmlFor={`${uid}-cat`} className={labelCls}>
              Category
            </label>
            <select
              id={`${uid}-cat`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`${controlCls} cursor-pointer appearance-none`}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div
          className={`${fieldWrap} rounded-2xl bg-cream md:rounded-none md:border-l md:border-line md:bg-transparent`}
        >
          <MapPin className="h-5 w-5 shrink-0 text-coral-600" aria-hidden="true" />
          <div className="min-w-0 flex-1 py-2">
            <label htmlFor={`${uid}-loc`} className={labelCls}>
              Area
            </label>
            <select
              id={`${uid}-loc`}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={`${controlCls} cursor-pointer appearance-none`}
            >
              <option value="">Anywhere</option>
              <optgroup label="Towns & areas">
                {areas.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Parishes">
                {parishes.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-lg m-0 h-14 w-full rounded-2xl md:ml-2 md:h-auto md:w-auto md:rounded-full md:px-8"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
          <span>Search</span>
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-white/80">Try:</span>
        {SEARCH_EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => navigate(routes.businesses(ex.params))}
            className="rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition-colors hover:bg-white hover:text-navy"
          >
            {ex.label}
          </button>
        ))}
      </div>
    </div>
  );
}
