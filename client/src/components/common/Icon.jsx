/**
 * Named-icon lookup for icons referenced from data (categories, amenities). Only the icons
 * listed here are bundled — importing `* as Icons` would pull in the entire Lucide set.
 */
import {
  Accessibility,
  AirVent,
  Armchair,
  Baby,
  Backpack,
  BedDouble,
  Briefcase,
  Car,
  CookingPot,
  CreditCard,
  Flower2,
  GraduationCap,
  Landmark,
  Palmtree,
  PlaneLanding,
  Sailboat,
  Salad,
  ShoppingBag,
  ShoppingBasket,
  SquareParking,
  Sunset,
  Users,
  UtensilsCrossed,
  Waves,
  WavesLadder,
  Wifi,
  Sparkles,
} from 'lucide-react';

const registry = {
  Accessibility,
  AirVent,
  Armchair,
  Baby,
  Backpack,
  BedDouble,
  Briefcase,
  Car,
  CookingPot,
  CreditCard,
  Flower2,
  GraduationCap,
  Landmark,
  Palmtree,
  PlaneLanding,
  Sailboat,
  Salad,
  ShoppingBag,
  ShoppingBasket,
  SquareParking,
  Sunset,
  Users,
  UtensilsCrossed,
  Waves,
  WavesLadder,
  Wifi,
};

export function Icon({ name, ...props }) {
  const Component = registry[name] ?? Sparkles;
  return <Component aria-hidden="true" {...props} />;
}
