import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from './useDebounce';
import { usePagination } from './usePagination';
import { inDateRange } from '@/utils/formatDate';

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Search + filters + date range + sort + pagination + selection for a client-side table.
 * Filter values live in the URL so views are shareable and survive back/forward.
 *
 * @param {object[]} rows
 * @param {{
 *   searchFields: (row) => string[],
 *   filters?: Record<string, (row, value) => boolean>,
 *   dateField?: string,
 *   sorters?: Record<string, (row) => string|number>,
 *   defaultSort?: { key: string, dir: 'asc'|'desc' },
 *   pageSize?: number,
 * }} config
 */
export function useTableState(
  rows,
  { searchFields, filters = {}, dateField, sorters = {}, defaultSort, pageSize = 10 },
) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const debouncedQ = useDebounce(q, 200);
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const sortKey = params.get('sort') ?? defaultSort?.key ?? '';
  const sortDir = params.get('dir') ?? defaultSort?.dir ?? 'asc';
  const filterValues = useMemo(
    () => Object.fromEntries(Object.keys(filters).map((k) => [k, params.get(k) ?? ''])),
    [filters, params],
  );

  const setParam = useCallback(
    (changes) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(changes)) {
            if (v === '' || v === null || v === undefined) next.delete(k);
            else next.set(k, String(v));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const filtered = useMemo(() => {
    const terms = norm(debouncedQ).trim().split(/\s+/).filter(Boolean);
    let out = rows.filter((row) => {
      if (terms.length) {
        const text = norm(searchFields(row).join(' '));
        if (!terms.every((t) => text.includes(t))) return false;
      }
      for (const [k, fn] of Object.entries(filters)) {
        if (filterValues[k] && !fn(row, filterValues[k])) return false;
      }
      if (dateField && (from || to) && !inDateRange(row[dateField], from, to)) return false;
      return true;
    });
    const sorter = sorters[sortKey];
    if (sorter) {
      out = [...out].sort((a, b) => {
        const va = sorter(a);
        const vb = sorter(b);
        const cmp =
          typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }
    return out;
  }, [rows, debouncedQ, filters, filterValues, dateField, from, to, sorters, sortKey, sortDir, searchFields]);

  const resetKey = `${debouncedQ}|${JSON.stringify(filterValues)}|${from}|${to}|${sortKey}|${sortDir}`;
  const pagination = usePagination(filtered, { pageSize, resetKey });

  const [selected, setSelected] = useState(() => new Set());
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const pageIds = pagination.pageItems.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  const clearSelection = () => setSelected(new Set());
  // Drop selections that no longer exist (e.g. after delete)
  const validSelected = [...selected].filter((id) => rows.some((r) => r.id === id));

  const activeFilterCount =
    Object.values(filterValues).filter(Boolean).length + (from || to ? 1 : 0) + (q ? 1 : 0);

  return {
    q,
    setQ: (v) => setParam({ q: v }),
    filterValues,
    setFilter: (k, v) => setParam({ [k]: v }),
    dateFrom: from,
    dateTo: to,
    setDateRange: (f, t) => setParam({ from: f, to: t }),
    sortKey,
    sortDir,
    setSort: (key) => setParam({ sort: key, dir: sortKey === key && sortDir === 'asc' ? 'desc' : 'asc' }),
    setSortExplicit: (key, dir) => setParam({ sort: key, dir }),
    resetAll: () =>
      setParam({ q: '', from: '', to: '', ...Object.fromEntries(Object.keys(filters).map((k) => [k, ''])) }),
    activeFilterCount,
    filtered,
    ...pagination,
    selectedIds: validSelected,
    isSelected: (id) => selected.has(id),
    toggle,
    togglePage,
    allOnPage,
    someOnPage: pageIds.some((id) => selected.has(id)),
    clearSelection,
  };
}
