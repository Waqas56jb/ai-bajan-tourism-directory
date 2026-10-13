import { motion } from 'framer-motion';

/**
 * Scroll-triggered fade-and-rise (Intersection Observer via Framer's `whileInView`).
 * Fires once. Reduced-motion users get no movement (MotionConfig reducedMotion="user").
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className = '',
  as = 'div',
  once = true,
  amount = 0.2,
}) {
  const Component = motion[as] ?? motion.div;
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </Component>
  );
}
