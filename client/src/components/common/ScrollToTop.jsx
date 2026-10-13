import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scroll to the top when the *path* changes (not when only query params change, so filtering
 * the directory doesn't jump the page). Respects in-page #hash links.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (hash) {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) {
        el.scrollIntoView({ block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return null;
}
