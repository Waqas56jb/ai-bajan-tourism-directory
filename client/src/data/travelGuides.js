/**
 * Sample editorial guides.
 *
 * Content sticks to widely established, general information and points readers to official
 * sources for anything time-sensitive (entry rules, schedules, prices, opening hours).
 * `author` and `publishedAt` are intentionally null — the UI hides them until real editorial
 * metadata is supplied. Reading time is calculated from the text.
 */

export const guideCategories = [
  'Planning',
  'Coast Guides',
  'Food & Drink',
  'Adventure',
  'Culture',
  'Getting Around',
];

export const travelGuides = [
  {
    slug: 'first-time-visitors-guide-to-barbados',
    title: 'A First-Time Visitor’s Guide to Barbados',
    category: 'Planning',
    image: 'heroBarbados',
    excerpt:
      'Coasts, parishes, getting around and the little things that make a first trip easier — the essentials before you land.',
    author: null,
    publishedAt: null,
    featured: true,
    relatedCategories: ['hotels', 'transportation', 'restaurants'],
    relatedDestinations: ['holetown', 'bridgetown', 'christ-church'],
    sections: [
      {
        id: 'island-at-a-glance',
        heading: 'The island at a glance',
        body: `Barbados is the most easterly island in the Caribbean, a compact coral island divided into eleven parishes. English is the official language, and you will quickly hear Bajan — the island’s distinctive, musical way of speaking.

Because the island is small, it is easy to see a lot of it. The trick is understanding how different each coast feels.`,
      },
      {
        id: 'choosing-a-coast',
        heading: 'Choosing a coast',
        body: `- **West Coast (Saint James and Saint Peter):** generally calm Caribbean water, sunsets and a more upscale feel around Holetown and Speightstown.
- **South Coast (Christ Church):** livelier, with a wide choice of guesthouses, restaurants and nightlife around Hastings, St. Lawrence Gap and Oistins.
- **East Coast (Saint Joseph and Saint Andrew):** the wild Atlantic side. Dramatic scenery at places like Bathsheba, but strong currents make many spots unsuitable for swimming.

Many visitors base themselves on the west or south coast and make day trips to the east.`,
      },
      {
        id: 'getting-around',
        heading: 'Getting around',
        body: `Barbados drives on the left. Taxis, private drivers, car hire and the public bus network all have their place — see our [transport guide](/guides/getting-around-barbados) for an overview, and browse [transport providers](/category/transportation) in the directory.

Always agree a taxi fare before you set off, and check the driving and permit requirements directly with your rental company.`,
      },
      {
        id: 'before-you-go',
        heading: 'Before you go',
        body: `Entry requirements, health guidance and travel rules can change. Check the official Government of Barbados and Barbados tourism sources, and your own government’s travel advice, shortly before you travel.

> AI Bajan is a discovery guide, not an official source of travel regulations.`,
      },
      {
        id: 'make-it-local',
        heading: 'Make it local',
        body: `Some of the best memories come from small, independent places: a family-run guesthouse, a fish shack, a craft maker’s studio. Use the [AI Bajan directory](/businesses) to find them by area, and ask the AI Bajan assistant when you are not sure where to start.`,
      },
    ],
  },
  {
    slug: 'exploring-the-west-coast',
    title: 'Exploring the West Coast',
    category: 'Coast Guides',
    image: 'holetownAerial',
    excerpt:
      'Calm water, sunset dinners and historic towns — how to spend slow days between Holetown and Speightstown.',
    author: null,
    publishedAt: null,
    featured: false,
    relatedCategories: ['restaurants', 'tours', 'hotels'],
    relatedDestinations: ['holetown', 'speightstown'],
    sections: [
      {
        id: 'why-the-west-coast',
        heading: 'Why the west coast?',
        body: `Sheltered from the Atlantic trade winds, the west coast usually has calmer water than the rest of the island. That makes it a favourite for swimming, snorkelling and boat trips — and its west-facing beaches are made for sunsets.`,
      },
      {
        id: 'holetown',
        heading: 'Holetown',
        body: `Holetown in Saint James is widely recognised as the site of the first English settlement in Barbados, in 1627. Today it is a compact town with beaches, restaurants and boutiques close together. Explore [Holetown listings](/places/holetown).`,
      },
      {
        id: 'speightstown',
        heading: 'Speightstown',
        body: `Further north in Saint Peter, Speightstown was once a busy trading port. It has a slower, more local rhythm and some of the island’s older streetscapes. It is a lovely place for an unhurried afternoon. See [Speightstown listings](/places/speightstown).`,
      },
      {
        id: 'on-the-water',
        heading: 'On the water',
        body: `Catamaran cruises and snorkel trips are among the most popular west coast experiences, often including a chance to see sea turtles. Choose operators who keep a respectful distance from wildlife and give a clear safety briefing.

Browse [tours and adventures](/category/tours) to compare operators.`,
      },
    ],
  },
  {
    slug: 'where-to-experience-local-bajan-food',
    title: 'Where to Experience Local Bajan Food',
    category: 'Food & Drink',
    image: 'grilledFish',
    excerpt:
      'Flying fish and cou-cou, fish cakes, macaroni pie and pepper sauce — a starter’s guide to eating like a local.',
    author: null,
    publishedAt: null,
    featured: false,
    relatedCategories: ['restaurants', 'shopping'],
    relatedDestinations: ['oistins', 'st-lawrence-gap', 'bridgetown'],
    sections: [
      {
        id: 'national-dish',
        heading: 'Start with the national dish',
        body: `Cou-cou and flying fish is the national dish of Barbados. Cou-cou is a smooth cornmeal and okra dish, served with flying fish steamed in a seasoned sauce. You will find it on menus at many local restaurants.`,
      },
      {
        id: 'everyday-favourites',
        heading: 'Everyday favourites',
        body: `- **Fish cakes:** crisp, salt-fish fritters — the classic snack.
- **Macaroni pie:** a baked macaroni cheese that is a staple side dish.
- **Cutters:** bread rolls filled with fish, ham, egg or cheese.
- **Pepper sauce:** Bajan hot sauce, usually yellow and fiery. Taste with care!`,
      },
      {
        id: 'fish-fry',
        heading: 'The fish fry',
        body: `The Oistins Fish Fry on the south coast is one of the island’s best-known food experiences, with grilled and fried fish, music and a sociable crowd. Days and times can vary, so check locally before you go. Explore [Oistins](/places/oistins).`,
      },
      {
        id: 'take-it-home',
        heading: 'Take flavours home',
        body: `Local pepper sauces, seasonings and sweets make great souvenirs. Look for island-made products in [local shops and markets](/category/shopping), and check your home country’s customs rules for food items.`,
      },
    ],
  },
  {
    slug: 'outdoor-adventures-around-the-island',
    title: 'Outdoor Adventures Around the Island',
    category: 'Adventure',
    image: 'catamaranAerial',
    excerpt:
      'Sailing, snorkelling, surfing and hiking — the island’s best outdoor experiences and how to choose an operator.',
    author: null,
    publishedAt: null,
    featured: false,
    relatedCategories: ['tours', 'attractions'],
    relatedDestinations: ['bathsheba', 'holetown', 'hastings'],
    sections: [
      {
        id: 'sailing-and-snorkelling',
        heading: 'Sailing and snorkelling',
        body: `The calmer west and south-west coasts are ideal for catamaran trips and snorkelling. Carlisle Bay, beside Bridgetown, is known for shipwrecks in shallow water that attract snorkellers and divers. Hawksbill and green turtles are often seen along the west coast.`,
      },
      {
        id: 'surfing',
        heading: 'Surfing',
        body: `The east coast, especially the Soup Bowl at Bathsheba, is famous among experienced surfers. Beginners usually learn on gentler south coast breaks with a qualified instructor. Find [surf schools and water sports](/category/tours).`,
      },
      {
        id: 'on-foot',
        heading: 'On foot',
        body: `Guided hikes cross the island’s quieter countryside, gullies and coastal paths, especially in the north and east. Bring water, sun protection and proper shoes.`,
      },
      {
        id: 'choosing-an-operator',
        heading: 'Choosing an operator',
        body: `Ask what is included (gear, transfers, food), the group size, the cancellation policy and the safety briefing. Responsible operators respect marine life — no touching or feeding turtles.

AI Bajan does not show live availability or prices; contact operators directly to book.`,
      },
    ],
  },
  {
    slug: 'discovering-barbados-beyond-the-beaches',
    title: 'Discovering Barbados Beyond the Beaches',
    category: 'Culture',
    image: 'huntesGardens',
    excerpt:
      'Gardens, heritage streets, music and festivals — the side of Barbados most visitors wish they had found sooner.',
    author: null,
    publishedAt: null,
    featured: false,
    relatedCategories: ['culture', 'attractions', 'shopping'],
    relatedDestinations: ['bridgetown', 'bathsheba', 'speightstown'],
    sections: [
      {
        id: 'heritage',
        heading: 'Heritage you can walk through',
        body: `Historic Bridgetown and its Garrison were inscribed as a UNESCO World Heritage Site in 2011. A walk through the capital reveals centuries of history in its streets, churches and public buildings. Explore [Bridgetown](/places/bridgetown).`,
      },
      {
        id: 'gardens',
        heading: 'Tropical gardens',
        body: `The lush interior, particularly around Saint Joseph, is home to several well-known tropical gardens, including Hunte’s Gardens. Royal palms, heliconias and shaded paths make for a peaceful break from the sun. Check opening times directly with each garden.`,
      },
      {
        id: 'music-and-festivals',
        heading: 'Music and festivals',
        body: `Crop Over, the island’s biggest festival, traces its roots to celebrations marking the end of the sugar-cane harvest and builds through the summer to Grand Kadooment Day. Tuk — a folk music of drums and penny whistle — is another distinctly Bajan tradition.`,
      },
      {
        id: 'meet-the-makers',
        heading: 'Meet the makers',
        body: `Craft studios, galleries and markets are the best way to support local artists. Browse [shopping and local markets](/category/shopping) and [culture and heritage](/category/culture) listings.`,
      },
    ],
  },
  {
    slug: 'getting-around-barbados',
    title: 'Getting Around Barbados',
    category: 'Getting Around',
    image: 'palmRoadCar',
    excerpt:
      'Taxis, buses, car hire and scooters — an overview of your options and what to check before you go.',
    author: null,
    publishedAt: null,
    featured: false,
    relatedCategories: ['transportation'],
    relatedDestinations: ['bridgetown', 'christ-church'],
    sections: [
      {
        id: 'driving',
        heading: 'Driving',
        body: `Barbados drives on the left. Main highways connect the coasts, but many roads are narrow and winding. If you plan to hire a car, ask your rental company about insurance and any visitor driving permit required.`,
      },
      {
        id: 'taxis-and-drivers',
        heading: 'Taxis and private drivers',
        body: `Taxis are widely available. Agree the fare before you set off. For a day of sightseeing, a private driver who knows the island can be a relaxed alternative to driving yourself. Browse [transport providers](/category/transportation).`,
      },
      {
        id: 'buses',
        heading: 'Buses and route taxis',
        body: `Public buses and privately operated minibuses and route taxis (often called ZRs) serve much of the island. They are popular with locals and budget travellers. Routes, fares and timetables change, so check current information from official sources.`,
      },
      {
        id: 'two-wheels',
        heading: 'On two wheels',
        body: `Scooters and e-bikes can be handy for short trips along the south coast. Wear a helmet, check licence requirements and take extra care on busy roads.`,
      },
    ],
  },
];

export const guideBySlug = Object.fromEntries(travelGuides.map((g) => [g.slug, g]));

/** Reading time in minutes at ~220 wpm, from the guide's actual text. */
export function getReadingTime(guide) {
  const text = [guide.excerpt, ...guide.sections.map((s) => `${s.heading} ${s.body}`)].join(' ');
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}
