import { Link, NavLink } from 'react-router-dom';
import { ChevronRight, MessageCircle, Store } from 'lucide-react';
import { categories } from '@/data/categories';
import { primaryNav, routes } from '@/lib/routes';
import { Drawer } from '@/components/common/Overlays';
import { Icon } from '@/components/common/Icon';
import { Logo } from '@/components/common/Logo';
import { Button } from '@/components/common/Button';

/** Slide-in drawer. Radix handles focus trap, Escape, focus return and scroll lock. */
export function MobileNavigation({ open, onOpenChange }) {
  const close = () => onOpenChange(false);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Menu"
      titleHidden
      header={<Logo onClick={close} />}
      footer={
        <div className="grid gap-3">
          <Button
            variant="accent"
            size="lg"
            className="w-full"
            iconLeft={<MessageCircle className="h-5 w-5" aria-hidden="true" />}
            to={routes.ask()}
            onClick={close}
          >
            Start asking
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            to={routes.forBusiness()}
            onClick={close}
            iconLeft={<Store className="h-5 w-5" aria-hidden="true" />}
          >
            List your business
          </Button>
        </div>
      }
    >
      <nav aria-label="Mobile" className="px-3 py-4">
        <ul className="space-y-1">
          {primaryNav
            .filter((item) => !item.menu)
            .map((item) => (
              <li key={item.label}>
                <NavLink
                  to={item.to}
                  end
                  onClick={close}
                  className={({ isActive }) =>
                    `flex min-h-14 items-center justify-between rounded-2xl px-4 text-lg font-bold transition-colors ${isActive ? 'bg-white text-ocean-700 shadow-soft' : 'text-navy hover:bg-white'}`
                  }
                >
                  {item.label}
                  <ChevronRight className="h-5 w-5 text-muted" aria-hidden="true" />
                </NavLink>
              </li>
            ))}
        </ul>

        <p className="mb-2 mt-7 px-4 text-xs font-extrabold uppercase tracking-[0.14em] text-muted">
          Categories
        </p>
        <ul className="grid grid-cols-2 gap-2 px-1">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                to={routes.category(c.slug)}
                onClick={close}
                className="flex min-h-14 items-center gap-2.5 rounded-2xl bg-white px-3 py-2.5 text-sm font-bold text-navy shadow-soft"
              >
                <Icon name={c.icon} className="h-5 w-5 shrink-0 text-ocean-700" />
                <span className="leading-tight">{c.shortName}</span>
              </Link>
            </li>
          ))}
        </ul>

        <ul className="mt-7 space-y-1 border-t border-line px-1 pt-5 text-[0.95rem]">
          {[
            { to: '/faq', label: 'FAQ' },
            { to: '/contact', label: 'Contact' },
          ].map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                onClick={close}
                className="block rounded-xl px-3 py-2.5 font-semibold text-muted hover:text-navy"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Drawer>
  );
}
