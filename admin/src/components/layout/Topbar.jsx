import { useState } from 'react';
import { CircleHelp, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { usePreferences } from '@/context/PreferencesContext';
import { IconButton } from '@/components/common/IconButton';
import { Modal } from '@/components/common/Modal';
import { Badge } from '@/components/common/Badge';
import { IS_DEMO } from '@/config/environment';
import { Breadcrumbs, useBreadcrumbs } from './Breadcrumbs';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsMenu } from './NotificationsMenu';
import { AccountMenu } from './Sidebar';

function HelpDialog({ open, onOpenChange }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Help & shortcuts"
      description="Quick reference for this demo dashboard."
    >
      <div className="space-y-5 text-sm">
        <section>
          <h3 className="mb-2 font-semibold">Keyboard shortcuts</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt>
              <span className="kbd">Ctrl</span> + <span className="kbd">K</span>
            </dt>
            <dd className="text-muted">Focus global search</dd>
            <dt>
              <span className="kbd">↑</span> <span className="kbd">↓</span> <span className="kbd">Enter</span>
            </dt>
            <dd className="text-muted">Move through and open search results</dd>
            <dt>
              <span className="kbd">Esc</span>
            </dt>
            <dd className="text-muted">Close dialogs, drawers and menus</dd>
          </dl>
        </section>
        <section>
          <h3 className="mb-2 font-semibold">About this environment</h3>
          <p className="text-muted">
            This is a frontend-only demo. All data is sample data stored in your browser. Sign-in,
            permissions, indexing, analytics and health checks are simulated and will be provided by the
            Node.js + Supabase backend. You can restore the original data from{' '}
            <strong className="text-ink">General Settings → Demo tools</strong>.
          </p>
        </section>
      </div>
    </Modal>
  );
}

export function Topbar({ onOpenMobileNav }) {
  const { collapsed, setCollapsed } = usePreferences();
  const [helpOpen, setHelpOpen] = useState(false);
  const crumbs = useBreadcrumbs();
  const current = crumbs.at(-1)?.label;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <IconButton
          label="Open navigation"
          icon={Menu}
          onClick={onOpenMobileNav}
          className="lg:hidden"
          tooltip={false}
        />
        <IconButton
          label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:inline-flex"
        />
        <div className="hidden min-w-0 flex-1 md:block">
          <Breadcrumbs />
          {crumbs.length <= 1 && current && (
            <p className="truncate text-sm font-semibold text-ink">{current}</p>
          )}
        </div>
        <div className="flex min-w-0 flex-1 justify-end md:flex-none">
          <div className="w-full md:w-72 xl:w-96">
            <GlobalSearch />
          </div>
        </div>
        {IS_DEMO && (
          <Badge tone="sand" className="hidden xl:inline-flex">
            Demo data
          </Badge>
        )}
        <NotificationsMenu />
        <IconButton
          label="Help & shortcuts"
          icon={CircleHelp}
          onClick={() => setHelpOpen(true)}
          className="hidden sm:inline-flex"
        />
        <div className="hidden sm:block">
          <AccountMenu collapsed />
        </div>
      </div>
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </header>
  );
}
