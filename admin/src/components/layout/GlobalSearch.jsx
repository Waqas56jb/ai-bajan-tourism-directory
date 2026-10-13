import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { Loader2, Search, SearchX } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { globalSearch } from '@/services/searchService';

/**
 * Searches listings, categories, locations, documents, FAQs and users.
 * Combobox pattern: ↑/↓ to move, Enter to open, Escape to close. Ctrl/⌘+K focuses it.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listId = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounce(q.trim(), 180);

  const { data: groups = [], isFetching } = useQuery({
    queryKey: ['globalSearch', debounced],
    queryFn: () => globalSearch(debounced),
    enabled: debounced.length >= 2,
    staleTime: 10_000,
  });

  const flat = useMemo(
    () => groups.flatMap((g) => g.items.map((item) => ({ ...item, group: g.type }))),
    [groups],
  );

  useEffect(() => setActive(0), [debounced]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (item) => {
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
    navigate(item.to);
  };

  const showPanel = open && debounced.length >= 2;

  return (
    <Popover.Root open={showPanel} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className="relative w-full max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <label htmlFor={`${listId}-input`} className="sr-only">
            Search the admin
          </label>
          <input
            ref={inputRef}
            id={`${listId}-input`}
            type="text"
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showPanel && flat[active] ? `${listId}-${flat[active].id}` : undefined}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, flat.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter' && flat[active]) {
                e.preventDefault();
                go(flat[active]);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            placeholder="Search listings, documents, users…"
            autoComplete="off"
            className="field h-9 bg-subtle/70 pl-9 pr-14"
          />
          <span
            className="kbd pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 sm:inline"
            aria-hidden="true"
          >
            Ctrl K
          </span>
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (e.target === inputRef.current) e.preventDefault();
          }}
          className="z-[80] w-[var(--radix-popover-trigger-width)] min-w-[18rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
        >
          <div
            id={listId}
            role="listbox"
            aria-label="Search results"
            className="scrollbar-thin max-h-[60vh] overflow-y-auto p-1.5"
          >
            {isFetching && !flat.length ? (
              <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Searching…
              </p>
            ) : flat.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-6 text-center">
                <SearchX className="mb-2 h-5 w-5 text-muted" aria-hidden="true" />
                <p className="text-sm font-medium text-ink">No results for “{debounced}”</p>
                <p className="mt-0.5 text-xs text-muted">Try a business name, document title or email.</p>
              </div>
            ) : (
              groups.map((g) => (
                <div key={g.type} role="group" aria-label={g.type}>
                  <p className="px-2.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-muted">
                    {g.type}
                  </p>
                  {g.items.map((item) => {
                    const index = flat.findIndex((f) => f.id === item.id && f.group === g.type);
                    return (
                      <div
                        key={item.id}
                        id={`${listId}-${item.id}`}
                        role="option"
                        aria-selected={index === active}
                        onMouseEnter={() => setActive(index)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(item)}
                        className={`cursor-pointer rounded-lg px-2.5 py-2 ${index === active ? 'bg-subtle' : ''}`}
                      >
                        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                        {item.subtitle && <p className="truncate text-xs text-muted">{item.subtitle}</p>}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
