import { useEffect, useMemo, useState } from 'react';

/** Client-side pagination. Resets to page 1 when `resetKey` changes (e.g. filters). */
export function usePagination(items, { pageSize: initialSize = 10, resetKey } = {}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);

  useEffect(() => setPage(1), [resetKey, pageSize]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);

  const pageItems = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize],
  );

  return {
    page: current,
    pageSize,
    pageCount,
    total: items.length,
    pageItems,
    setPage,
    setPageSize,
    from: items.length ? (current - 1) * pageSize + 1 : 0,
    to: Math.min(current * pageSize, items.length),
  };
}
