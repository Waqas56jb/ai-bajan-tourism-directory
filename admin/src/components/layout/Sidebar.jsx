import { useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronsUpDown, LogOut, Settings, UserRound, Palette } from 'lucide-react';
import { NAV_GROUPS } from '@/config/navigation';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useApiQuery } from '@/hooks/useApi';
import { getListings } from '@/services/listingService';
import { getSyncJobs } from '@/services/knowledgeService';
import { getFeedback } from '@/services/feedbackService';
import { useAuth } from '@/context/AuthContext';
import { ADMIN_ROLES } from '@/utils/permissions';
import { Avatar } from '@/components/common/Avatar';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import { SidebarGroup, isItemActive } from './SidebarGroup';
import { Logo } from './Logo';

/** Live counts for nav badges. */
function useNavBadges() {
  const listings = useApiQuery('listings', getListings);
  const jobs = useApiQuery('syncJobs', getSyncJobs);
  const feedback = useApiQuery('feedback', getFeedback);
  return {
    pending: (listings.data ?? []).filter((l) => l.status === 'pending').length,
    syncFailed: (jobs.data ?? []).filter((j) => j.status === 'failed').length,
    feedbackNew: (feedback.data ?? []).filter((f) => f.status === 'new').length,
  };
}

export function AccountMenu({ collapsed = false, onNavigate }) {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const name = admin?.name ?? 'Administrator';
  return (
    <DropdownMenu
      label="Account menu"
      align={collapsed ? 'start' : 'end'}
      header={
        <div>
          <p className="truncate text-sm font-semibold text-ink">{name}</p>
          <p className="truncate text-xs text-muted">{admin?.email}</p>
        </div>
      }
      items={[
        { label: 'Account settings', icon: UserRound, to: '/settings/account' },
        { label: 'Appearance', icon: Palette, to: '/settings/appearance' },
        { label: 'Platform settings', icon: Settings, to: '/settings/general' },
        {
          label: 'Sign out',
          icon: LogOut,
          separatorBefore: true,
          onSelect: () => {
            onNavigate?.();
            logout();
            navigate('/login', { replace: true });
          },
        },
      ]}
      trigger={
        <button
          type="button"
          className={`flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-subtle ${collapsed ? 'justify-center' : ''}`}
          aria-label={`Account menu for ${name}`}
        >
          <Avatar name={name} size="sm" />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{name}</span>
                <span className="block truncate text-xs text-muted">
                  {ADMIN_ROLES[admin?.role]?.label ?? 'Demo role'}
                </span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            </>
          )}
        </button>
      }
    />
  );
}

/** Shared sidebar body (desktop sidebar + mobile drawer). */
export function SidebarContent({ collapsed = false, onNavigate }) {
  const { pathname } = useLocation();
  const badges = useNavBadges();
  const [expandedState, setExpandedState] = useLocalStorage('sidebar_groups', {});

  const activeGroup = useMemo(
    () => NAV_GROUPS.find((g) => g.items.some((i) => isItemActive(i, pathname)))?.id,
    [pathname],
  );

  // Make sure the group containing the current page is open after navigation.
  useEffect(() => {
    if (activeGroup && expandedState[activeGroup] === false)
      setExpandedState((s) => ({ ...s, [activeGroup]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup]);

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-16 shrink-0 items-center border-b border-line ${collapsed ? 'justify-center px-2' : 'px-4'}`}
      >
        <Link
          to="/"
          onClick={onNavigate}
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="AI Bajan admin dashboard"
        >
          <Logo collapsed={collapsed} />
        </Link>
      </div>
      <nav
        aria-label="Main navigation"
        className={`scrollbar-thin flex-1 space-y-3 overflow-y-auto py-4 ${collapsed ? 'px-2' : 'px-3'}`}
      >
        {NAV_GROUPS.map((group) => (
          <SidebarGroup
            key={group.id}
            group={group}
            collapsed={collapsed}
            badges={badges}
            onNavigate={onNavigate}
            expanded={expandedState[group.id] ?? true}
            onToggle={() => setExpandedState((s) => ({ ...s, [group.id]: !(s[group.id] ?? true) }))}
          />
        ))}
      </nav>
      <div className={`shrink-0 border-t border-line ${collapsed ? 'p-2' : 'p-3'}`}>
        <AccountMenu collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export function Sidebar({ collapsed }) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden border-r border-line bg-surface transition-[width] duration-200 lg:block"
      style={{ width: collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)' }}
      aria-label="Sidebar"
    >
      <SidebarContent collapsed={collapsed} />
    </aside>
  );
}
