import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { Bell, CheckCheck } from 'lucide-react';
import { useApiQuery } from '@/hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/monitoringService';
import { formatRelative } from '@/utils/formatDate';
import { EmptyState } from '@/components/common/States';

const DOT = { danger: 'bg-danger', warning: 'bg-warning', info: 'bg-info', success: 'bg-success' };

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data = [] } = useApiQuery('notifications', getNotifications);
  const unread = data.filter((n) => !n.read).length;

  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="relative grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        >
          <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.6rem] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-[80] w-[min(92vw,360px)] overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <button
              type="button"
              disabled={!unread}
              onClick={async () => {
                await markAllNotificationsRead();
                refresh();
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent-600 hover:underline disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Mark all read
            </button>
          </div>
          {data.length === 0 ? (
            <EmptyState compact icon={Bell} title="You’re all caught up" />
          ) : (
            <ul className="scrollbar-thin max-h-96 divide-y divide-line overflow-y-auto">
              {data.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={async () => {
                      setOpen(false);
                      navigate(n.to);
                      if (!n.read) {
                        await markNotificationRead(n.id);
                        refresh();
                      }
                    }}
                    className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-subtle ${n.read ? '' : 'bg-accent-50/50'}`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-line' : (DOT[n.tone] ?? 'bg-info')}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">
                        {n.title}
                        {!n.read && <span className="sr-only"> (unread)</span>}
                      </span>
                      <span className="block text-xs text-muted">{n.body}</span>
                      <span className="mt-0.5 block text-2xs text-muted">{formatRelative(n.at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-line bg-subtle/50 px-4 py-2 text-2xs text-muted">
            Sample notifications — no real alerts are generated yet.
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
