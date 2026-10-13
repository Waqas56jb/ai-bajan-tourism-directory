/**
 * Areas, parishes and destination pages.
 *
 * Destination copy sticks to well-established, general facts about each place. It avoids
 * schedules, prices and opening times, which change and must come from official sources.
 *
 * Coordinates are approximate town / parish centres used only to position area-level map
 * markers. They are never presented as a business's exact location.
 */

export const parishes = [
  'Christ Church',
  'Saint Andrew',
  'Saint George',
  'Saint James',
  'Saint John',
  'Saint Joseph',
  'Saint Lucy',
  'Saint Michael',
  'Saint Peter',
  'Saint Philip',
  'Saint Thomas',
];

/** Towns / areas used on business records. `aliases` support search and chat matching. */
export const areas = [
  {
    name: 'Holetown',
    parish: 'Saint James',
    coast: 'West Coast',
    center: [13.1866, -59.6375],
    aliases: ['holetown', 'hole town'],
  },
  {
    name: 'Bridgetown',
    parish: 'Saint Michael',
    coast: 'South-West',
    center: [13.0969, -59.6145],
    aliases: ['bridgetown', 'bridge town', 'the city', 'capital'],
  },
  {
    name: 'Speightstown',
    parish: 'Saint Peter',
    coast: 'West Coast',
    center: [13.2496, -59.6431],
    aliases: ['speightstown', 'speights town', 'speightown'],
  },
  {
    name: 'Oistins',
    parish: 'Christ Church',
    coast: 'South Coast',
    center: [13.0636, -59.5401],
    aliases: ['oistins', 'oistin'],
  },
  {
    name: 'Bathsheba',
    parish: 'Saint Joseph',
    coast: 'East Coast',
    center: [13.2132, -59.5226],
    aliases: ['bathsheba', 'soup bowl'],
  },
  {
    name: 'St. Lawrence Gap',
    parish: 'Christ Church',
    coast: 'South Coast',
    center: [13.0676, -59.5672],
    aliases: [
      'st lawrence gap',
      'st. lawrence gap',
      'saint lawrence gap',
      'the gap',
      'lawrence gap',
      'dover',
    ],
  },
  {
    name: 'Hastings',
    parish: 'Christ Church',
    coast: 'South Coast',
    center: [13.0767, -59.5999],
    aliases: ['hastings'],
  },
  {
    name: 'Crane',
    parish: 'Saint Philip',
    coast: 'South-East',
    center: [13.1055, -59.4434],
    aliases: ['crane', 'crane beach', 'saint philip coast'],
  },
];

export const areaByName = Object.fromEntries(areas.map((a) => [a.name, a]));

/** Parish-level aliases (e.g. "St James", "St. Michael"). */
export const parishAliases = Object.fromEntries(
  parishes.flatMap((p) => {
    const short = p.replace('Saint ', '');
    const list = [p.toLowerCase(), `st ${short.toLowerCase()}`, `st. ${short.toLowerCase()}`];
    if (p === 'Christ Church') list.push('christchurch');
    return list.map((alias) => [alias, p]);
  }),
);

export const coasts = {
  'West Coast': 'Calm Caribbean-side beaches, sunsets and upscale dining.',
  'South Coast': 'Lively beaches, restaurants and nightlife.',
  'East Coast': 'Dramatic Atlantic scenery and world-known surf.',
};

export const destinations = [
  {
    slug: 'holetown',
    name: 'Holetown',
    type: 'town',
    filter: { area: 'Holetown' },
    parish: 'Saint James',
    region: 'West Coast',
    image: 'holetownAerial',
    gallery: ['holetownAerial', 'holetownPalm', 'calmCove'],
    caption: 'Calm west coast water, dining and boutique shopping.',
    intro:
      'Holetown sits on the sheltered west coast of Barbados, where the Caribbean Sea is usually calm and clear. It is widely recognised as the site of the first English settlement on the island in 1627, and today mixes beaches, restaurants and shopping within easy walking distance.',
    highlights: [
      {
        title: 'Calm-water beaches',
        text: 'The west coast is generally sheltered, making it popular for swimming and snorkelling.',
      },
      {
        title: 'Dining and shopping',
        text: 'A compact town centre with restaurants, cafés and boutiques.',
      },
      {
        title: 'Island history',
        text: 'One of the oldest settlements in Barbados, with a long story to explore.',
      },
    ],
    aiPrompts: [
      'Find restaurants near Holetown.',
      'Show stays in Holetown.',
      'Which tours start near Holetown?',
    ],
  },
  {
    slug: 'bridgetown',
    name: 'Bridgetown',
    type: 'town',
    filter: { area: 'Bridgetown' },
    parish: 'Saint Michael',
    region: 'South-West',
    image: 'colourfulStreet',
    gallery: ['colourfulStreet', 'churchPalms', 'barbadosFlag'],
    caption: 'The capital, with UNESCO-listed historic streets.',
    intro:
      'Bridgetown is the capital of Barbados. Historic Bridgetown and its Garrison were inscribed as a UNESCO World Heritage Site in 2011, recognising the city’s colonial-era street plan and architecture. Expect busy shopping streets, waterfront walks and easy access to Carlisle Bay.',
    highlights: [
      {
        title: 'World Heritage streets',
        text: 'Historic Bridgetown and its Garrison are UNESCO World Heritage listed.',
      },
      {
        title: 'Carlisle Bay nearby',
        text: 'A broad bay just south of the city, popular for swimming and boat trips.',
      },
      {
        title: 'Shopping and markets',
        text: 'The island’s main commercial centre, from department stores to street vendors.',
      },
    ],
    aiPrompts: [
      'Explore local shops in Bridgetown.',
      'Find heritage experiences in Bridgetown.',
      'Find catamaran cruises from Bridgetown.',
    ],
  },
  {
    slug: 'speightstown',
    name: 'Speightstown',
    type: 'town',
    filter: { area: 'Speightstown' },
    parish: 'Saint Peter',
    region: 'West Coast',
    image: 'palmBeachBoat',
    gallery: ['palmBeachBoat', 'fishingBoats', 'mangoes'],
    caption: 'A relaxed northern town with deep roots.',
    intro:
      'Speightstown, on the north-west coast in Saint Peter, was once a busy trading port and still has a slower, more local feel than the towns further south. Old buildings line its streets and the waterfront is a peaceful place to watch the sunset.',
    highlights: [
      {
        title: 'Historic port town',
        text: 'Once an important trading port, with older architecture still standing.',
      },
      { title: 'Local pace', text: 'Quieter than the busier west coast towns to the south.' },
      {
        title: 'Sunset waterfront',
        text: 'West-facing shoreline with open views across the Caribbean Sea.',
      },
    ],
    aiPrompts: [
      'Show markets in Speightstown.',
      'Find restaurants in Speightstown.',
      'What stays are listed in Speightstown?',
    ],
  },
  {
    slug: 'oistins',
    name: 'Oistins',
    type: 'town',
    filter: { area: 'Oistins' },
    parish: 'Christ Church',
    region: 'South Coast',
    image: 'fishingBoats',
    gallery: ['fishingBoats', 'grilledFish', 'friedPlantain'],
    caption: 'Fishing town famous for its lively fish fry.',
    intro:
      'Oistins is a fishing town on the south coast in Christ Church. It is best known for its fish market and the popular Oistins Fish Fry, where visitors and locals gather for grilled and fried fish, music and a sociable atmosphere.',
    highlights: [
      {
        title: 'Oistins Fish Fry',
        text: 'A well-known gathering for fresh fish dishes and music. Check current days and times locally.',
      },
      { title: 'Working fish market', text: 'See the island’s fishing culture up close.' },
      {
        title: 'South coast beaches',
        text: 'Close to Miami Beach (Enterprise) and other south coast spots.',
      },
    ],
    aiPrompts: [
      'Show seafood spots in Oistins.',
      'Find stays near Oistins.',
      'What is listed in Oistins?',
    ],
  },
  {
    slug: 'bathsheba',
    name: 'Bathsheba',
    type: 'town',
    filter: { area: 'Bathsheba' },
    parish: 'Saint Joseph',
    region: 'East Coast',
    image: 'barbadosSurfRocks',
    gallery: ['barbadosSurfRocks', 'surfTurquoise', 'huntesGardens'],
    caption: 'Atlantic surf and dramatic rock formations.',
    intro:
      'Bathsheba is on the rugged Atlantic east coast in Saint Joseph. Its giant rock formations and powerful surf make it one of the most photographed places in Barbados, and the Soup Bowl break is known among surfers worldwide. Strong currents mean swimming here calls for real caution.',
    highlights: [
      {
        title: 'Iconic rock formations',
        text: 'Huge boulders shaped by the Atlantic stand just offshore.',
      },
      { title: 'Soup Bowl surf', text: 'A famous reef break for experienced surfers.' },
      {
        title: 'Gardens nearby',
        text: 'The lush interior of Saint Joseph is home to several tropical gardens.',
      },
    ],
    aiPrompts: [
      'Find surf lessons near Bathsheba.',
      'Show stays on the east coast.',
      'What gardens are listed in the directory?',
    ],
  },
  {
    slug: 'st-lawrence-gap',
    name: 'St. Lawrence Gap',
    type: 'town',
    filter: { area: 'St. Lawrence Gap' },
    parish: 'Christ Church',
    region: 'South Coast',
    image: 'beachBarStools',
    gallery: ['beachBarStools', 'beachDiningRoom', 'beachSeafoodPlate'],
    caption: 'The south coast’s dining and nightlife strip.',
    intro:
      'St. Lawrence Gap — usually just called “the Gap” — is a short strip on the south coast lined with restaurants, bars and places to stay. It is a convenient base if you want to walk to dinner and be close to the beach.',
    highlights: [
      { title: 'Walkable dining', text: 'Restaurants and bars along one compact street.' },
      { title: 'Evening atmosphere', text: 'One of the island’s best-known areas for nightlife.' },
      { title: 'Beach access', text: 'South coast beaches are a short walk away.' },
    ],
    aiPrompts: [
      'Find restaurants in St. Lawrence Gap.',
      'Show stays in the Gap.',
      'What is listed in St. Lawrence Gap?',
    ],
  },
  {
    slug: 'christ-church',
    name: 'Christ Church',
    type: 'parish',
    filter: { parish: 'Christ Church' },
    parish: 'Christ Church',
    region: 'South Coast',
    image: 'coastlineAerial',
    gallery: ['coastlineAerial', 'beachTreelineAerial', 'lagoonPool'],
    caption: 'The sunny south coast parish, from Hastings to Oistins.',
    intro:
      'Christ Church is the southernmost parish of Barbados. Its coastline takes in Hastings, Worthing, St. Lawrence Gap and Oistins, with a wide choice of beaches, guesthouses and restaurants, and the international airport is in the parish too.',
    highlights: [
      {
        title: 'Plenty of places to stay',
        text: 'From guesthouses and apartments to beachfront hotels.',
      },
      {
        title: 'Varied beaches',
        text: 'Calmer bays and breezier stretches popular with windsurfers.',
      },
      { title: 'Close to the airport', text: 'A convenient first or last stop on a trip.' },
    ],
    aiPrompts: [
      'Show guesthouses in Christ Church.',
      'Find restaurants in Christ Church.',
      'What tours are listed on the south coast?',
    ],
  },
  {
    slug: 'hastings',
    name: 'Hastings',
    type: 'town',
    filter: { area: 'Hastings' },
    parish: 'Christ Church',
    region: 'South Coast',
    image: 'turquoiseReefAerial',
    gallery: ['turquoiseReefAerial', 'snorkelReef', 'turtleSunlight'],
    caption: 'Boardwalk strolls and easy south coast living.',
    intro:
      'Hastings is on the south coast close to Bridgetown. The waterfront boardwalk is popular for morning walks and sunset strolls, and the area has a good mix of places to stay and eat.',
    highlights: [
      {
        title: 'Coastal boardwalk',
        text: 'A seaside walkway that is popular with walkers and joggers.',
      },
      { title: 'Close to Bridgetown', text: 'A short trip to the capital and Carlisle Bay.' },
      { title: 'Relaxed base', text: 'Convenient for exploring the whole south coast.' },
    ],
    aiPrompts: [
      'Find stays in Hastings.',
      'Show restaurants in Hastings.',
      'What wellness options are listed in Hastings?',
    ],
  },
];

export const destinationBySlug = Object.fromEntries(destinations.map((d) => [d.slug, d]));

/** Find the destination page that represents an area or parish name, if any. */
export function findDestinationForLocation(location) {
  if (!location) return null;
  return (
    destinations.find((d) => d.filter.area === location || d.filter.parish === location) ?? null
  );
}
