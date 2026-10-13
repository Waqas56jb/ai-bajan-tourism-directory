export const faqGroups = [
  {
    title: 'Using AI Bajan',
    items: [
      {
        id: 'find-businesses',
        question: 'How do I find businesses?',
        answer:
          'Use the search on the homepage or the Explore Businesses page. You can search by name or keyword, then narrow results by category, area or parish, business type and amenities. Every filter is reflected in the page address, so you can bookmark or share a search.',
      },
      {
        id: 'how-ai-works',
        question: 'How does the AI Bajan assistant work?',
        answer:
          'The assistant looks for answers in the AI Bajan directory and approved travel information. In this preview it runs in demo mode: answers come from a simple, rules-based search of the sample listings — not from a live AI model. When it is connected to the AI Bajan service, answers will still be grounded in directory and approved content.',
      },
      {
        id: 'chatbot-sources',
        question: 'Where does chatbot information come from?',
        answer:
          'Only from information available to AI Bajan — directory listings and approved travel content. When a source is available, the assistant shows it alongside the answer. It does not browse the web or know live prices, availability or opening hours unless a business has supplied them.',
      },
      {
        id: 'unavailable-info',
        question: 'What happens when information is unavailable?',
        answer:
          'The assistant will say so rather than guess. It may suggest a broader search, a related category, or contacting the business directly.',
      },
    ],
  },
  {
    title: 'Listings & advertising',
    items: [
      {
        id: 'request-listing',
        question: 'How can a business request a listing?',
        answer:
          'Send a listing enquiry through the contact page and choose “Business listing” as the enquiry type. The AI Bajan team will follow up about the information needed. Submitting an enquiry does not guarantee that a listing will be published.',
      },
      {
        id: 'sponsored-meaning',
        question: 'What does a sponsored listing mean?',
        answer:
          'Sponsored listings are paid placements. They are always labelled “Sponsored” so you can tell them apart from regular results. “Featured” labels highlight listings selected for promotion. Neither label is a review or an endorsement of quality.',
      },
      {
        id: 'verified-meaning',
        question: 'Are listings verified?',
        answer:
          'A “Verified” badge only appears when a listing has been through AI Bajan’s verification process. Listings without the badge have not been verified. Always confirm important details — prices, availability, opening times — directly with the business.',
      },
      {
        id: 'report-incorrect',
        question: 'How can I report incorrect listing information?',
        answer:
          'Use the contact page, choose “General inquiry”, and include the business name and what needs correcting. Reports are reviewed, but we cannot promise a specific response time.',
      },
      {
        id: 'demo-listings',
        question: 'Why do some listings say “Demo”?',
        answer:
          'This version of AI Bajan is a preview. Listings marked “Demo” are fictional examples that show how the directory works. They are not real businesses and their contact details do not work.',
      },
    ],
  },
];

export const faqs = faqGroups.flatMap((g) => g.items);
