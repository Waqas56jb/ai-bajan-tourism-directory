import { buildLexicon } from '../../src/rag/lexicon.js';

/** Static lexicon mirroring the integration fixture (ids are fixed fake UUIDs). */
export const IDS = {
  catHotels: '00000000-0000-4000-8000-000000000101',
  catRestaurants: '00000000-0000-4000-8000-000000000102',
  catPharmacies: '00000000-0000-4000-8000-000000000103',
  catAttractions: '00000000-0000-4000-8000-000000000104',
  catTours: '00000000-0000-4000-8000-000000000105',
  locBarbados: '00000000-0000-4000-8000-000000000201',
  locStMichael: '00000000-0000-4000-8000-000000000202',
  locBridgetown: '00000000-0000-4000-8000-000000000203',
  locStJames: '00000000-0000-4000-8000-000000000204',
  locHoletown: '00000000-0000-4000-8000-000000000205',
  locChristChurch: '00000000-0000-4000-8000-000000000206',
  locOistins: '00000000-0000-4000-8000-000000000207',
  lstHarbourPharmacy: '00000000-0000-4000-8000-000000000301',
  lstCoralReefHotel: '00000000-0000-4000-8000-000000000302',
};

export const testLexicon = buildLexicon(
  [
    { id: IDS.catHotels, slug: 'hotels', name: 'Hotels and Accommodation', parent_id: null, synonyms: [] },
    { id: IDS.catRestaurants, slug: 'restaurants', name: 'Restaurants', parent_id: null, synonyms: [] },
    { id: IDS.catPharmacies, slug: 'pharmacies', name: 'Pharmacies', parent_id: null, synonyms: [] },
    { id: IDS.catAttractions, slug: 'attractions', name: 'Attractions', parent_id: null, synonyms: [] },
    { id: IDS.catTours, slug: 'tours', name: 'Tours and Excursions', parent_id: null, synonyms: [] },
  ],
  [
    { id: IDS.locBarbados, slug: 'barbados', name: 'Barbados', type: 'country', parent_id: null, aliases: [] },
    { id: IDS.locStMichael, slug: 'st-michael', name: 'St. Michael', type: 'region', parent_id: IDS.locBarbados, aliases: ['saint michael'] },
    { id: IDS.locBridgetown, slug: 'bridgetown', name: 'Bridgetown', type: 'city', parent_id: IDS.locStMichael, aliases: [] },
    { id: IDS.locStJames, slug: 'st-james', name: 'St. James', type: 'region', parent_id: IDS.locBarbados, aliases: ['saint james', 'west coast'] },
    { id: IDS.locHoletown, slug: 'holetown', name: 'Holetown', type: 'city', parent_id: IDS.locStJames, aliases: [] },
    { id: IDS.locChristChurch, slug: 'christ-church', name: 'Christ Church', type: 'region', parent_id: IDS.locBarbados, aliases: ['south coast'] },
    { id: IDS.locOistins, slug: 'oistins', name: 'Oistins', type: 'city', parent_id: IDS.locChristChurch, aliases: [] },
  ],
  [
    { id: IDS.lstHarbourPharmacy, name: 'Harbour Lights Pharmacy', slug: 'harbour-lights-pharmacy' },
    { id: IDS.lstCoralReefHotel, name: 'Coral Reef Hotel', slug: 'coral-reef-hotel' },
  ],
);
