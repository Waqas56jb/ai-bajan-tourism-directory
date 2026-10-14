/**
 * Starter topics on the Ask AI Bajan page. Residents get the 20 priority questions agreed with the
 * client; visitors get travel-focused ones. Live-data topics (weather, outages, news, prices) will be
 * marked live once their feeds are connected — until then AI Bajan answers from its sources and says
 * when information may not be current.
 */
export const RESIDENT_TOPICS = [
  { group: 'Work & money', icon: 'Briefcase', q: 'What jobs are available in Barbados right now?' },
  { group: 'News & alerts', icon: 'Newspaper', q: 'What is the latest news in Barbados today?' },
  { group: 'News & alerts', icon: 'CloudSun', q: 'Is there a storm or hurricane warning for Barbados?' },
  { group: 'Services near me', icon: 'MapPin', q: 'Where can I find a tyre repair shop near me?' },
  { group: 'Getting around', icon: 'Bus', q: 'Which bus or route taxi should I take to Bridgetown?' },
  { group: 'Government', icon: 'Landmark', q: 'How do I renew my Barbados passport?' },
  { group: 'News & alerts', icon: 'Zap', q: 'Why is my electricity or water off, and when will it return?' },
  { group: 'Out & about', icon: 'CalendarDays', q: 'What events are happening in Barbados this weekend?' },
  { group: 'Work & money', icon: 'Tag', q: 'Where can I find the best price for building materials?' },
  { group: 'Home', icon: 'Home', q: 'Where can I rent an affordable apartment in Christ Church?' },
  { group: 'Health', icon: 'Stethoscope', q: 'Which doctors, clinics or pharmacies are open now?' },
  { group: 'Government', icon: 'HandCoins', q: 'How do I apply for an NIS benefit or pension?' },
  { group: 'Learning', icon: 'GraduationCap', q: 'What scholarships or training programmes are available?' },
  { group: 'Government', icon: 'Building2', q: 'How do I register a business in Barbados?' },
  { group: 'Your rights', icon: 'Scale', q: 'What are my rights as an employee, tenant or consumer?' },
  { group: 'Government', icon: 'CreditCard', q: 'Where can I pay a bill or a government fee online?' },
  { group: 'Services near me', icon: 'Car', q: 'Where can I get vehicle repairs, parts or an inspection?' },
  { group: 'Work & money', icon: 'ShoppingCart', q: 'What are this week’s supermarket specials?' },
  { group: 'Home', icon: 'Wrench', q: 'Who can repair or maintain my home — plumber or electrician?' },
  { group: 'Government', icon: 'Megaphone', q: 'How do I report a pothole or make a complaint?' },
];

export const VISITOR_TOPICS = [
  { group: 'Plan', icon: 'Plane', q: 'What do I need to enter Barbados as a visitor?' },
  { group: 'Getting around', icon: 'Bus', q: 'How do I get around Barbados without a car?' },
  { group: 'Eat', icon: 'Utensils', q: 'What are Bajan fish cakes and where can I try them?' },
  { group: 'Culture', icon: 'Sparkles', q: 'What is Crop Over?' },
  { group: 'Explore', icon: 'MapPin', q: 'What can I do in Bridgetown in one day?' },
  { group: 'Explore', icon: 'Waves', q: 'Which beaches are best on the south and west coasts?' },
  { group: 'History', icon: 'Landmark', q: 'Why is Barbados called Little England?' },
  { group: 'Money', icon: 'Banknote', q: 'What currency is used in Barbados?' },
];
