import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Modal } from '@/components/common/Overlays';
import { SearchInput } from '@/components/common/Fields';
import { Button } from '@/components/common/Button';
import { categories } from '@/data/categories';
import { routes } from '@/lib/routes';

const QUICK_SEARCHES = [
  { label: 'Restaurants in Holetown', params: { category: 'restaurants', location: 'Holetown' } },
  { label: 'Guesthouses in Christ Church', params: { q: 'guesthouse', location: 'Christ Church' } },
  { label: 'Snorkeling tours', params: { q: 'snorkeling', category: 'tours' } },
  {
    label: 'Local shops in Speightstown',
    params: { category: 'shopping', location: 'Speightstown' },
  },
];

/** Global search shortcut (header search button on every breakpoint). */
export function SearchDialog({ open, onOpenChange }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  const go = (params) => {
    onOpenChange(false);
    setQ('');
    navigate(routes.businesses(params));
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Search Barbados"
      placement="top"
      className="sm:p-8"
    >
      <form
        role="search"
        className="mt-5 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: q.trim() });
        }}
      >
        <SearchInput
          value={q}
          onChange={setQ}
          label="Search businesses, places and experiences"
          placeholder="Try “seafood”, “catamaran” or “Bathsheba”"
          className="flex-1"
          autoFocus
        />
        <Button type="submit" variant="primary" size="lg">
          Search
        </Button>
      </form>
      <div className="mt-6">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-muted">
          Popular searches
        </p>
        <ul className="flex flex-wrap gap-2">
          {QUICK_SEARCHES.map((s) => (
            <li key={s.label}>
              <button
                type="button"
                onClick={() => go(s.params)}
                className="rounded-full border border-line bg-cream px-3.5 py-2 text-sm font-semibold text-navy transition-colors hover:border-ocean hover:text-ocean-700"
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
        <p className="mb-2 mt-6 text-xs font-extrabold uppercase tracking-[0.14em] text-muted">
          Browse by category
        </p>
        <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                to={routes.category(c.slug)}
                onClick={() => onOpenChange(false)}
                className="group flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-navy hover:bg-sand"
              >
                {c.shortName}
                <ArrowRight
                  className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
