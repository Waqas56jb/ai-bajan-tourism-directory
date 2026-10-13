/**
 * Helpers for building DEMO datasets. Dates are generated relative to "today" so the dashboard
 * always looks current, and pseudo-random numbers are seeded so data is stable between reloads.
 */
const DAY = 86_400_000;
const today = new Date();
today.setHours(9, 0, 0, 0);
export const DEMO_NOW = today.getTime();

/** ISO timestamp `days` before today at a given hour/minute. Negative days = future. */
export function daysAgo(days, hour = 10, minute = 0) {
  const d = new Date(DEMO_NOW - days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function minutesAgo(mins) {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

/** Deterministic PRNG (mulberry32) so "random" demo values don't change between reloads. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const between = (rand, min, max) => Math.round(min + rand() * (max - min));

/**
 * Pexels photos (Pexels License: free to use, attribution appreciated). Same set the public
 * site uses. Several are illustrative Caribbean scenes rather than specific Barbados locations.
 */
const pexels = (id, w = 800) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const IDS = {
  seafood: 14389434,
  fishDinner: 19615775,
  grilledFish: 15146204,
  plantain: 27556971,
  mangoes: 27694877,
  mangoesRed: 30893227,
  fruitStall: 709567,
  craftMarket: 18934577,
  craftShopping: 4072329,
  beachBar: 13356976,
  beachShack: 18801054,
  beachDining: 3660229,
  resortPool: 33191057,
  gardenPool: 14024023,
  villas: 15298798,
  poolGazebo: 261101,
  lagoonPool: 34410674,
  cabana: 30016219,
  pavilion: 1024967,
  catamaran: 746683,
  catamaranTurquoise: 9408818,
  boatWake: 4669603,
  snorkel: 12360242,
  snorkelReef: 10802752,
  turtle: 13010771,
  turtleSun: 2404369,
  surf: 31065025,
  surfSunset: 16354188,
  palmRoad: 8744557,
  jeep: 4577418,
  church: 18934203,
  stoneBuilding: 30110201,
  street: 11897606,
  holetown: 1309756,
  holetownPalm: 27970932,
  huntes: 29097403,
  surfRocks: 27367825,
  cove: 248797,
  coast: 11670749,
  reef: 20097582,
};

export const img = Object.fromEntries(Object.entries(IDS).map(([k, id]) => [k, pexels(id)]));
export const imgLarge = (key) => pexels(IDS[key], 1600);
