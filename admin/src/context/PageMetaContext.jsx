import { createContext, useContext, useEffect, useState } from 'react';

const PageMetaContext = createContext({ title: null, setTitle: () => {} });

/** Lets detail pages replace the last breadcrumb with a record name (e.g. a listing title). */
export function PageMetaProvider({ children }) {
  const [title, setTitle] = useState(null);
  return <PageMetaContext.Provider value={{ title, setTitle }}>{children}</PageMetaContext.Provider>;
}

export function usePageMeta() {
  return useContext(PageMetaContext);
}

/** Set document title + dynamic breadcrumb label for the current page. */
export function usePageTitle(title) {
  const { setTitle } = useContext(PageMetaContext);
  useEffect(() => {
    if (title) document.title = `${title} · AI Bajan Admin`;
    setTitle(title ?? null);
    return () => setTitle(null);
  }, [title, setTitle]);
}
