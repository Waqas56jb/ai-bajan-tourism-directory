/** Curated icon set for categories (only these are bundled). */
import {
  BedDouble,
  Briefcase,
  Car,
  Coffee,
  Flower2,
  Home,
  Landmark,
  Map,
  Mountain,
  Music,
  Palmtree,
  Sailboat,
  ShoppingBag,
  Sparkles,
  Store,
  Tent,
  UtensilsCrossed,
  Waves,
} from 'lucide-react';

export const CATEGORY_ICONS = {
  BedDouble,
  Home,
  UtensilsCrossed,
  Coffee,
  Landmark,
  Waves,
  Sailboat,
  Car,
  ShoppingBag,
  Store,
  Flower2,
  Briefcase,
  Sparkles,
  Music,
  Map,
  Mountain,
  Palmtree,
  Tent,
};

export function CategoryIcon({ name, className = 'h-4 w-4' }) {
  const Icon = CATEGORY_ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden="true" />;
}
