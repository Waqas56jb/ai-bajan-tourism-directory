import { useId } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';

export function isItemActive(item, pathname) {
  const exact = item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
  return exact || (item.matchPrefix ?? []).some((p) => pathname.startsWith(p));
}

function NavItem({ item, collapsed, badgeCount, onNavigate }) {
  const { pathname } = useLocation();
  const active = isItemActive(item, pathname);
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors ${
        active ? 'bg-accent/10 text-accent-600' : 'text-muted hover:bg-subtle hover:text-ink'
      } ${collapsed ? 'justify-center px-0' : ''}`}
    >
      {active && (
        <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-accent" aria-hidden="true" />
      )}
      <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      {collapsed ? (
        <span className="sr-only">{item.label}</span>
      ) : (
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      )}
      {badgeCount > 0 &&
        (collapsed ? (
          <span
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger"
            aria-label={`${badgeCount} pending`}
          />
        ) : (
          <span
            className="rounded-full bg-danger/10 px-1.5 text-2xs font-semibold tabular text-danger"
            aria-label={`${badgeCount} pending`}
          >
            {badgeCount}
          </span>
        ))}
    </NavLink>
  );
  return (
    <li>
      <Tooltip content={item.label} side="right" disabled={!collapsed}>
        {link}
      </Tooltip>
    </li>
  );
}

/** A labelled, collapsible group of nav links. Collapsed sidebar shows icons only. */
export function SidebarGroup({ group, collapsed, expanded, onToggle, badges, onNavigate }) {
  const listId = useId();
  if (collapsed) {
    return (
      <ul
        className="space-y-0.5 border-t border-line pt-2 first:border-0 first:pt-0"
        aria-label={group.label}
      >
        {group.items.map((item) => (
          <NavItem
            key={item.to}
            item={item}
            collapsed
            badgeCount={badges[item.badge] ?? 0}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    );
  }
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={listId}
        className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted hover:text-ink"
      >
        {group.label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul
            id={listId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-0.5 space-y-0.5 overflow-hidden"
          >
            {group.items.map((item) => (
              <NavItem
                key={item.to}
                item={item}
                collapsed={false}
                badgeCount={badges[item.badge] ?? 0}
                onNavigate={onNavigate}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
