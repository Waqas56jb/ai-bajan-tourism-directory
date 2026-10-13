/** Controlled amenity vocabulary. Filters only show amenities that appear in the data. */
export const amenities = {
  'family-friendly': { label: 'Family-friendly', icon: 'Baby' },
  'wheelchair-accessible': { label: 'Wheelchair accessible', icon: 'Accessibility' },
  beachfront: { label: 'Beachfront', icon: 'Waves' },
  'ocean-view': { label: 'Ocean view', icon: 'Sunset' },
  'outdoor-seating': { label: 'Outdoor seating', icon: 'Armchair' },
  'vegetarian-options': { label: 'Vegetarian options', icon: 'Salad' },
  takeaway: { label: 'Takeaway', icon: 'ShoppingBasket' },
  'free-wifi': { label: 'Free Wi-Fi', icon: 'Wifi' },
  pool: { label: 'Pool', icon: 'WavesLadder' },
  kitchen: { label: 'Kitchen / self-catering', icon: 'CookingPot' },
  'air-conditioning': { label: 'Air conditioning', icon: 'AirVent' },
  parking: { label: 'Parking', icon: 'SquareParking' },
  'airport-transfers': { label: 'Airport transfers', icon: 'PlaneLanding' },
  'card-payments': { label: 'Card payments', icon: 'CreditCard' },
  'gear-included': { label: 'Gear included', icon: 'Backpack' },
  'beginner-friendly': { label: 'Beginner-friendly', icon: 'GraduationCap' },
  'private-groups': { label: 'Private groups', icon: 'Users' },
};

export function getAmenityLabel(key) {
  return amenities[key]?.label ?? key;
}
