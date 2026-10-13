/**
 * MOCK API — in-browser stand-in for the future Node.js API.
 *
 * - Each collection is seeded from src/data and persisted to namespaced localStorage so demo
 *   edits survive navigation and refresh.
 * - Calls are async with a short simulated latency so loading states are real.
 * - Writes can be made to fail (VITE_MOCK_FAILURE_RATE, or the "Simulate failures" demo
 *   toggle in Settings) to exercise error handling.
 *
 * Nothing here talks to a server. Replace the service modules' internals with real HTTP calls
 * when the backend exists (see README → "Connecting the backend").
 */
import { MOCK_FAILURE_RATE, MOCK_LATENCY_MS } from '@/config/environment';
import { readJSON, writeJSON, removeKey } from '@/utils/storage';

export class ApiError extends Error {
  constructor(message, { status = 500, code = 'ERROR', retryable = true } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const FAIL_KEY = 'simulate_failures';

export function getSimulateFailures() {
  return readJSON(FAIL_KEY, false) === true;
}
export function setSimulateFailures(on) {
  writeJSON(FAIL_KEY, Boolean(on));
}

const wait = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/** Run a mock request with latency and optional simulated failure. */
export async function simulate(fn, { write = false, latency = MOCK_LATENCY_MS } = {}) {
  await wait(latency + (write ? 150 : 0));
  if (write && (getSimulateFailures() || Math.random() < MOCK_FAILURE_RATE)) {
    throw new ApiError(
      'The demo service simulated a failure. Your changes were not saved — please try again.',
      {
        code: 'SIMULATED_FAILURE',
      },
    );
  }
  return clone(await fn());
}

export const notFound = (what = 'Record') =>
  new ApiError(`${what} not found.`, { status: 404, code: 'NOT_FOUND', retryable: false });

export const conflict = (message) =>
  new ApiError(message, { status: 409, code: 'CONFLICT', retryable: false });

let idSeq = Date.now() % 100000;
export function newId(prefix) {
  idSeq += 1;
  return `${prefix}-${idSeq.toString(36)}`;
}

const registry = new Map();

/**
 * A persisted collection of records with string `id`s.
 * @param {string} key storage key (namespaced automatically)
 * @param {object[]} seed initial demo records
 */
export function createCollection(key, seed) {
  let cache = null;

  const load = () => {
    if (cache) return cache;
    const stored = readJSON(key, null);
    cache =
      Array.isArray(stored) && stored.every((r) => r && typeof r.id === 'string') ? stored : clone(seed);
    return cache;
  };
  const save = () => writeJSON(key, cache);

  const collection = {
    key,
    all: () => load(),
    find: (id) => load().find((r) => r.id === id) ?? null,
    insert(record) {
      load().unshift(record);
      save();
      return record;
    },
    patch(id, changes) {
      const list = load();
      const i = list.findIndex((r) => r.id === id);
      if (i === -1) throw notFound();
      list[i] = { ...list[i], ...changes };
      save();
      return list[i];
    },
    delete(id) {
      const list = load();
      const i = list.findIndex((r) => r.id === id);
      if (i === -1) throw notFound();
      const [removed] = list.splice(i, 1);
      save();
      return removed;
    },
    reset() {
      cache = clone(seed);
      removeKey(key);
    },
  };
  registry.set(key, collection);
  return collection;
}

/** A persisted single settings object merged over defaults. */
export function createDocument(key, defaults) {
  return {
    get: () => ({ ...clone(defaults), ...(readJSON(key, {}) || {}) }),
    set: (value) => writeJSON(key, value),
    reset: () => removeKey(key),
    defaults: () => clone(defaults),
  };
}

/** Reset every registered collection to its seed (used by "Reset demo data"). */
export function resetAllCollections() {
  for (const c of registry.values()) c.reset();
}
