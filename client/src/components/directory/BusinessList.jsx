import { motion } from 'framer-motion';
import { BusinessCard } from './BusinessCard';

/** Grid or list of business cards with a light staggered entrance. */
export function BusinessList({
  businesses,
  layout = 'grid',
  columns = 'sm:grid-cols-2 xl:grid-cols-3',
  headingLevel = 3,
}) {
  return (
    <ul className={layout === 'list' ? 'grid gap-5' : `grid gap-6 ${columns}`}>
      {businesses.map((b, i) => (
        <motion.li
          key={b.id}
          className="flex"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
        >
          <BusinessCard
            business={b}
            layout={layout}
            headingLevel={headingLevel}
            className="w-full"
          />
        </motion.li>
      ))}
    </ul>
  );
}
