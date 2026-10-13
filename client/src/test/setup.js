import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// Route pages are lazy-loaded; give the first import of each chunk time to resolve.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => cleanup());

// jsdom gaps
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
window.scrollTo = vi.fn();
Element.prototype.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

class IO {
  constructor(cb) {
    this.cb = cb;
  }
  observe(el) {
    this.cb([{ isIntersecting: true, target: el, intersectionRatio: 1 }]);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
window.IntersectionObserver = IO;
globalThis.IntersectionObserver = IO;

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = RO;
globalThis.ResizeObserver = RO;
