/**
 * Central image registry.
 *
 * Every photo used on the site is listed here with its source, licence and — where the
 * source page states it — the photographer and location. Components reference images by
 * key, never by raw URL, so swapping in client-supplied or self-hosted photography later is
 * a one-file change.
 *
 * Licensing: all remote photos are from Pexels and used under the Pexels License
 * (https://www.pexels.com/license/) — free for commercial use, attribution not required but
 * appreciated. Pexels' CDN supports on-the-fly resizing (`w=`), which we use to build srcSet.
 *
 * `isBarbados: true` only where the Pexels page tags the photo with a Barbados location.
 * Everything else is illustrative Caribbean / tropical photography and must not be captioned
 * as a specific Barbados place. Replace with licensed Barbados photography before launch where
 * possible.
 */

export const PEXELS_LICENSE_URL = 'https://www.pexels.com/license/';
export const FALLBACK_IMAGE = '/placeholders/image-fallback.svg';

const RESPONSIVE_WIDTHS = [480, 768, 1080, 1600, 2400];

/** @typedef {{ id?: number, local?: string, alt: string, credit: string|null, location: string|null, isBarbados: boolean, focal?: string }} ImageRecord */

/** @type {Record<string, ImageRecord>} */
export const images = {
  // ---- Confirmed Barbados (location stated on the source page) ----
  heroBarbados: {
    id: 35010454,
    local: '/images/hero-barbados',
    alt: 'Turquoise Caribbean water rolling onto a pale sand beach in Barbados under towering white clouds',
    credit: 'Gavin Fregona',
    location: 'Barbados',
    isBarbados: true,
    focal: 'center 62%',
  },
  holetownAerial: {
    id: 1309756,
    alt: 'Aerial view of golden sand meeting clear turquoise water on the beach at Holetown',
    credit: 'Lorilee E',
    location: 'Holetown, Saint James, Barbados',
    isBarbados: true,
  },
  holetownPalm: {
    id: 27970932,
    alt: 'A coconut palm swaying against a clear blue sky in Holetown',
    credit: 'Emily Carter',
    location: 'Holetown, Saint James, Barbados',
    isBarbados: true,
    focal: 'center 30%',
  },
  huntesGardens: {
    id: 29097403,
    alt: "Towering royal palms in Hunte's Gardens, Barbados",
    credit: 'Daniel Adesina',
    location: "Hunte's Gardens, Barbados",
    isBarbados: true,
    focal: 'center 35%',
  },
  huntesGardensSky: {
    id: 29097404,
    alt: "Looking up through tall palm trunks to a bright sky in Hunte's Gardens",
    credit: 'Daniel Adesina',
    location: "Hunte's Gardens, Barbados",
    isBarbados: true,
  },
  barbadosSurfRocks: {
    id: 27367825,
    alt: 'Black-and-white photo of Atlantic waves breaking over rocks on the Barbados coast',
    credit: 'Reynaldo Brigantty',
    location: 'Barbados',
    isBarbados: true,
  },
  barbadosFlag: {
    id: 31591629,
    alt: 'The blue and gold flag of Barbados with its black trident flying against a blue sky',
    credit: 'Reco Alleyne',
    location: 'Barbados',
    isBarbados: true,
  },

  // ---- Illustrative coast & sea (location not confirmed as Barbados) ----
  turquoiseReefAerial: {
    id: 20097582,
    alt: 'Drone view of shallow turquoise water over a reef near the coast',
    credit: null,
    location: null,
    isBarbados: false,
  },
  coastlineAerial: {
    id: 11670749,
    alt: 'Aerial view of a long curving beach with turquoise surf',
    credit: null,
    location: null,
    isBarbados: false,
  },
  beachTreelineAerial: {
    id: 1661375,
    alt: 'Aerial view of white surf rolling onto a beach edged by green trees',
    credit: null,
    location: null,
    isBarbados: false,
  },
  coastalVillageAerial: {
    id: 5625340,
    alt: 'Aerial view of a sandy beach and small coastal village beside rolling surf',
    credit: null,
    location: null,
    isBarbados: false,
  },
  resortCoastAerial: {
    id: 7981725,
    alt: 'Aerial view of a coastline with hotels behind a turquoise reef',
    credit: null,
    location: null,
    isBarbados: false,
  },
  calmCove: {
    id: 248797,
    alt: 'A calm cove with white sand and clear blue water under a bright sky',
    credit: null,
    location: null,
    isBarbados: false,
  },
  palmBeachBoat: {
    id: 29881454,
    alt: 'A small boat moored off a palm-lined beach at golden hour',
    credit: null,
    location: null,
    isBarbados: false,
  },
  fishingBoats: {
    id: 31785197,
    alt: 'Colourful fishing boats floating on calm sea water',
    credit: null,
    location: null,
    isBarbados: false,
  },

  // ---- Boats, snorkelling & marine life ----
  catamaranAerial: {
    id: 746683,
    alt: 'A white catamaran sailing across deep blue water, seen from above',
    credit: null,
    location: null,
    isBarbados: false,
  },
  catamaranTurquoise: {
    id: 9408818,
    alt: 'A white catamaran anchored in bright turquoise water',
    credit: null,
    location: null,
    isBarbados: false,
  },
  boatWake: {
    id: 4669603,
    alt: 'A boat leaving a white wake across turquoise water, seen from a drone',
    credit: null,
    location: null,
    isBarbados: false,
  },
  snorkelSelfie: {
    id: 12360242,
    alt: 'A snorkeller wearing a mask smiling just below the water surface',
    credit: null,
    location: null,
    isBarbados: false,
  },
  snorkelReef: {
    id: 10802752,
    alt: 'A person snorkelling over rocks in clear shallow water',
    credit: null,
    location: null,
    isBarbados: false,
  },
  turtleReef: {
    id: 13010771,
    alt: 'A sea turtle swimming above a colourful coral reef',
    credit: 'Saad Alaiyadhi',
    location: null,
    isBarbados: false,
  },
  turtleCloseUp: {
    id: 60087,
    alt: 'Close-up of a sea turtle gliding underwater',
    credit: null,
    location: null,
    isBarbados: false,
  },
  turtleSunlight: {
    id: 2404369,
    alt: 'A sea turtle swimming through sunlit blue water above a reef',
    credit: null,
    location: null,
    isBarbados: false,
  },

  // ---- Surf ----
  surfTurquoise: {
    id: 31065025,
    alt: 'A surfer riding a turquoise wave',
    credit: null,
    location: null,
    isBarbados: false,
  },
  surfSunset: {
    id: 16354188,
    alt: 'A surfer catching a wave at sunset',
    credit: null,
    location: null,
    isBarbados: false,
  },
  surfAerial: {
    id: 9259780,
    alt: 'Aerial view of a surfer paddling through white water',
    credit: null,
    location: null,
    isBarbados: false,
  },

  // ---- Food & markets ----
  friedPlantain: {
    id: 27556971,
    alt: 'Golden fried plantain slices on a white plate',
    credit: null,
    location: null,
    isBarbados: false,
  },
  beachSeafoodPlate: {
    id: 14389434,
    alt: 'A seafood plate with lobster and salad served at a table on the beach',
    credit: null,
    location: null,
    isBarbados: false,
  },
  grilledFish: {
    id: 15146204,
    alt: 'Grilled fish fillet with citrus on a plate',
    credit: null,
    location: null,
    isBarbados: false,
  },
  fishDinner: {
    id: 19615775,
    alt: 'A whole grilled fish plated with sauces in a restaurant',
    credit: null,
    location: null,
    isBarbados: false,
  },
  mangoes: {
    id: 27694877,
    alt: 'A pile of ripe yellow mangoes',
    credit: null,
    location: null,
    isBarbados: false,
  },
  mangoesRed: {
    id: 30893227,
    alt: 'Ripe red and green mangoes stacked on display',
    credit: null,
    location: null,
    isBarbados: false,
  },
  fruitStall: {
    id: 709567,
    alt: 'A market stall piled with bananas, watermelons and tropical fruit',
    credit: null,
    location: null,
    isBarbados: false,
  },
  craftMarket: {
    id: 18934577,
    alt: 'A roadside stall hung with handmade bags, hats and souvenirs',
    credit: null,
    location: null,
    isBarbados: false,
  },
  craftShopping: {
    id: 4072329,
    alt: 'A shopper browsing handmade souvenirs on a market table',
    credit: null,
    location: null,
    isBarbados: false,
  },

  // ---- Beach bars & dining spaces ----
  beachBarStools: {
    id: 13356976,
    alt: 'Wooden beach bar with stools facing the sand and sea',
    credit: null,
    location: null,
    isBarbados: false,
  },
  beachShack: {
    id: 18801054,
    alt: 'A small painted beach café shaded by trees',
    credit: null,
    location: null,
    isBarbados: false,
  },
  beachDiningRoom: {
    id: 3660229,
    alt: 'Wooden tables and chairs under a thatched roof facing the beach',
    credit: null,
    location: null,
    isBarbados: false,
  },

  // ---- Stays & wellness ----
  resortPoolPalms: {
    id: 33191057,
    alt: 'Aerial view of a resort pool surrounded by palm trees',
    credit: null,
    location: null,
    isBarbados: false,
  },
  gardenHotelPool: {
    id: 14024023,
    alt: 'A hotel pool and gardens surrounded by tropical palms',
    credit: null,
    location: null,
    isBarbados: false,
  },
  beachfrontVillas: {
    id: 15298798,
    alt: 'Beachfront villas with pools behind a wide sandy beach',
    credit: null,
    location: null,
    isBarbados: false,
  },
  poolGazebo: {
    id: 261101,
    alt: 'A curving swimming pool with a gazebo and palm trees',
    credit: null,
    location: null,
    isBarbados: false,
  },
  lagoonPool: {
    id: 34410674,
    alt: 'A clear lagoon-style pool fringed by trees under a blue sky',
    credit: null,
    location: null,
    isBarbados: false,
  },
  cabanaPool: {
    id: 30016219,
    alt: 'A cabana with blue drapes beside an infinity pool overlooking the ocean',
    credit: null,
    location: null,
    isBarbados: false,
  },
  sunsetPavilion: {
    id: 1024967,
    alt: 'A thatched pavilion reflected in an infinity pool at sunset',
    credit: null,
    location: null,
    isBarbados: false,
  },

  // ---- Heritage & streets ----
  churchPalms: {
    id: 18934203,
    alt: 'A historic church tower framed by tall palm trees',
    credit: null,
    location: null,
    isBarbados: false,
  },
  stoneBuilding: {
    id: 30110201,
    alt: 'An old coral-stone building on a grassy headland beside the sea',
    credit: null,
    location: null,
    isBarbados: false,
  },
  colourfulStreet: {
    id: 11897606,
    alt: 'A narrow street lined with brightly painted colonial buildings',
    credit: null,
    location: null,
    isBarbados: false,
  },

  // ---- Getting around ----
  palmRoadCar: {
    id: 8744557,
    alt: 'A white car driving on a palm-lined seaside road',
    credit: 'Dmitry Limonov',
    location: null,
    isBarbados: false,
  },
  jeepPalms: {
    id: 4577418,
    alt: 'A vintage open-top vehicle parked among coconut palms',
    credit: null,
    location: null,
    isBarbados: false,
  },
};

/** Build a Pexels CDN URL at a given width. */
export function pexelsUrl(id, width = 1080) {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
}

export function pexelsPageUrl(id) {
  return `https://www.pexels.com/photo/${id}/`;
}

/**
 * Resolve an image key into everything an <img> needs.
 * @param {string} key
 * @param {{ width?: number, widths?: number[] }} [opts]
 */
export function getImage(key, opts = {}) {
  const record = images[key];
  if (!record) return { src: FALLBACK_IMAGE, srcSet: undefined, alt: '', record: null };
  const widths = opts.widths ?? RESPONSIVE_WIDTHS;

  if (record.local) {
    const localWidths = [768, 1280, 1920, 2560];
    return {
      src: `${record.local}-1920.jpg`,
      srcSet: localWidths.map((w) => `${record.local}-${w}.jpg ${w}w`).join(', '),
      webpSrcSet: localWidths.map((w) => `${record.local}-${w}.webp ${w}w`).join(', '),
      alt: record.alt,
      record,
    };
  }

  return {
    src: pexelsUrl(record.id, opts.width ?? 1080),
    srcSet: widths.map((w) => `${pexelsUrl(record.id, w)} ${w}w`).join(', '),
    alt: record.alt,
    record,
  };
}

/** Attribution list for the credits section (About page / footer). */
export function getImageCredits() {
  return Object.entries(images).map(([key, r]) => ({
    key,
    credit: r.credit ?? 'Pexels contributor',
    location: r.location,
    isBarbados: r.isBarbados,
    sourceUrl: pexelsPageUrl(r.id),
  }));
}
