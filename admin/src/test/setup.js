import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { resetDemoData } from '@/services/settingsService';
import { logout } from '@/services/authService';

// Pages are lazy-loaded; allow time for the first import of each chunk.
configure({ asyncUtilTimeout: 15000 });

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetDemoData();
  logout();
});
afterEach(() => cleanup());

// jsdom gaps
// React Router's data router builds a native (undici) Request with a jsdom AbortSignal, which
// undici rejects. The app has no loaders/actions, so dropping the signal in tests is safe.
const NativeRequest = globalThis.Request;
globalThis.Request = class TestRequest extends NativeRequest {
  constructor(input, init) {
    if (init && 'signal' in init) {
      const { signal: _signal, ...rest } = init;
      super(input, rest);
    } else super(input, init);
  }
};
window.matchMedia =
  window.matchMedia ||
  ((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
window.scrollTo = vi.fn();
Element.prototype.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => {});

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = RO;
globalThis.ResizeObserver = RO;

class IO {
  constructor(cb) {
    this.cb = cb;
  }
  observe(el) {
    this.cb([{ isIntersecting: true, target: el }]);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
window.IntersectionObserver = IO;
globalThis.IntersectionObserver = IO;

if (!window.URL.createObjectURL) window.URL.createObjectURL = () => 'blob:mock';
if (!window.URL.revokeObjectURL) window.URL.revokeObjectURL = () => {};
