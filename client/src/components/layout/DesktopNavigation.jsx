import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { categories } from '@/data/categories';
import { primaryNav, routes } from '@/lib/routes';
import { Icon } from '@/components/common/Icon';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

function CategoriesMenu({ light }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const active = pathname.startsWith('/category/');

  return (
    <div
      ref={ref}
      className="relative"
      onBlur={(e) => !ref.current?.contains(e.relatedTarget) && setOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={navItemClass(active, light)}
      >
        Categories
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{ x: '-50%' }}
            className="absolute left-1/2 top-full z-50 mt-3 w-[min(92vw,760px)] overflow-hidden rounded-card border border-line bg-white shadow-lift"
          >
            <div className="grid grid-cols-[1fr_240px]">
              <ul className="grid grid-cols-2 gap-1 p-4">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link
                      to={routes.category(c.slug)}
                      className="group flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-sand focus-visible:bg-sand"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ocean/10 text-ocean-700 transition-colors group-hover:bg-ocean group-hover:text-white">
                        <Icon name={c.icon} className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block font-bold text-navy">{c.name}</span>
                        <span className="block text-sm leading-snug text-muted">{c.tagline}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link to="/businesses" className="group relative block overflow-hidden">
                <ImageWithFallback
                  imageKey="holetownPalm"
                  sizes="240px"
                  className="absolute inset-0"
                  decorative
                />
                <span className="absolute inset-0 bg-gradient-to-t from-navy-900/90 via-navy-900/30 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <span className="block font-display text-2xl leading-tight">
                    Browse the whole directory
                  </span>
                  <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-lagoon">
                    Explore businesses{' '}
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function navItemClass(active, light) {
  const base =
    'relative inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-[0.94rem] font-semibold transition-colors';
  if (light)
    return `${base} ${active ? 'text-white' : 'text-white/85 hover:text-white'} hover:bg-white/10`;
  return `${base} ${active ? 'text-navy' : 'text-ink/80 hover:text-navy'} hover:bg-navy/5`;
}

export function DesktopNavigation({ light }) {
  return (
    <nav aria-label="Main" className="hidden lg:block">
      <ul className="flex items-center gap-0.5">
        {primaryNav.map((item) =>
          item.menu === 'categories' ? (
            <li key={item.label}>
              <CategoriesMenu light={light} />
            </li>
          ) : (
            <li key={item.label}>
              <NavLink
                to={item.to}
                end={item.to === '/businesses'}
                className={({ isActive }) => navItemClass(isActive, light)}
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <motion.span
                        layoutId="nav-underline"
                        className={`absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded-full ${light ? 'bg-lagoon' : 'bg-ocean'}`}
                      />
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
