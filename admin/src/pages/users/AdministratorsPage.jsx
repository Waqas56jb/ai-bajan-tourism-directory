import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Eye, MoreHorizontal, Power, ShieldCheck, UserCog, UserPlus, X } from 'lucide-react';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useTableState';
import { getAdministrators, inviteAdministrator, updateAdministrator } from '@/services/userService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { FilterBar } from '@/components/common/FilterBar';
import { SearchInput, SelectField, TextField } from '@/components/common/Fields';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import { StatusBadge, Badge } from '@/components/common/Badge';
import { Avatar } from '@/components/common/Avatar';
import { Modal, Drawer } from '@/components/common/Modal';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { DemoNotice } from '@/components/common/States';
import { ACCOUNT_STATUSES } from '@/utils/constants';
import { ADMIN_ROLES, PERMISSIONS } from '@/utils/permissions';
import { formatDate, formatRelative } from '@/utils/formatDate';
import { CURRENT_ADMIN_ID } from '@/data/mockUsers';

const inviteSchema = z.object({
  name: z.string().trim().min(2, 'Name is required.'),
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  title: z.string().trim().max(60),
  role: z.enum(Object.keys(ADMIN_ROLES)),
});

function PermissionList({ role }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {Object.entries(PERMISSIONS).map(([k, label]) => {
        const on = ADMIN_ROLES[role]?.permissions.includes(k);
        return (
          <li key={k} className={`flex items-center gap-2 ${on ? 'text-ink' : 'text-muted'}`}>
            {on ? (
              <Check className="h-4 w-4 text-success" aria-hidden="true" />
            ) : (
              <X className="h-4 w-4 text-muted/60" aria-hidden="true" />
            )}
            {label}
            <span className="sr-only">{on ? '(allowed)' : '(not allowed)'}</span>
          </li>
        );
      })}
    </ul>
  );
}

function InviteModal({ open, onOpenChange }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(inviteSchema),
    defaultValues: { name: '', email: '', title: '', role: 'content_editor' },
  });
  useEffect(() => {
    if (open) reset({ name: '', email: '', title: '', role: 'content_editor' });
  }, [open, reset]);
  const invite = useApiMutation(inviteAdministrator, {
    invalidate: [['admins']],
    success: (a) => `${a.name} added as invited (demo — no email sent)`,
    error: 'Couldn’t invite administrator',
    onSuccess: () => onOpenChange(false),
  });
  const role = watch('role');
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Invite administrator"
      description="Creates a demo record only. No account is created and no invitation is sent."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button icon={UserPlus} loading={invite.isPending} onClick={handleSubmit((v) => invite.mutate(v))}>
            Add invite
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <form noValidate onSubmit={(e) => e.preventDefault()} className="space-y-4">
          <TextField label="Full name" required error={errors.name?.message} {...register('name')} />
          <TextField
            label="Email"
            type="email"
            required
            error={errors.email?.message}
            {...register('email')}
          />
          <TextField label="Job title" {...register('title')} />
          <SelectField
            label="Role"
            options={Object.entries(ADMIN_ROLES).map(([v, r]) => ({ value: v, label: r.label }))}
            {...register('role')}
          />
        </form>
        <div className="rounded-xl border border-line bg-subtle/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Permissions preview</p>
          <PermissionList role={role} />
        </div>
      </div>
    </Modal>
  );
}

export default function AdministratorsPage() {
  const { data: admins = [], isPending, isError, error, refetch } = useApiQuery('admins', getAdministrators);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [viewing, setViewing] = useState(null);
  const confirm = useConfirm();

  const config = useMemo(
    () => ({
      searchFields: (a) => [a.name, a.email, a.title],
      filters: { role: (a, v) => a.role === v, status: (a, v) => a.status === v },
      sorters: {
        name: (a) => a.name,
        lastLoginAt: (a) => (a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0),
        createdAt: (a) => new Date(a.createdAt).getTime(),
      },
      defaultSort: { key: 'name', dir: 'asc' },
    }),
    [],
  );
  const t = useTableState(admins, config);

  const update = useApiMutation(({ id, changes }) => updateAdministrator(id, changes), {
    invalidate: [['admins']],
    success: (a) => `Updated ${a.name}`,
    error: 'Couldn’t update administrator',
    onSuccess: () => setRoleTarget(null),
  });

  const toggleStatus = async (a) => {
    const next = a.status === 'deactivated' ? 'active' : 'deactivated';
    if (
      await confirm({
        title: `${next === 'active' ? 'Activate' : 'Deactivate'} ${a.name}?`,
        message: 'Demo change only — real access is controlled by the backend.',
        confirmLabel: next === 'active' ? 'Activate' : 'Deactivate',
        tone: next === 'active' ? undefined : 'danger',
      })
    ) {
      update.mutate({ id: a.id, changes: { status: next } });
    }
  };

  const menu = (a) => [
    { label: 'View details', icon: Eye, onSelect: () => setViewing(a) },
    {
      label: 'Edit role',
      icon: UserCog,
      disabled: a.id === CURRENT_ADMIN_ID,
      onSelect: () => {
        setNewRole(a.role);
        setRoleTarget(a);
      },
    },
    {
      label: a.status === 'deactivated' ? 'Activate' : 'Deactivate',
      icon: Power,
      disabled: a.id === CURRENT_ADMIN_ID,
      tone: a.status === 'deactivated' ? undefined : 'danger',
      separatorBefore: true,
      onSelect: () => toggleStatus(a),
    },
  ];

  return (
    <>
      <PageHeader
        title="Administrators"
        description="People who can sign in to this dashboard, and what each role can do."
        actions={
          <Button icon={UserPlus} onClick={() => setInviteOpen(true)}>
            Invite administrator
          </Button>
        }
      />
      <DemoNotice className="mb-5" title="Frontend roles only">
        Role checks in the browser are not security. The backend must enforce every permission.
      </DemoNotice>
      <Card padded={false}>
        <FilterBar
          chips={[
            t.q && { key: 'q', label: `Search: “${t.q}”`, onRemove: () => t.setQ('') },
            t.filterValues.role && {
              key: 'r',
              label: ADMIN_ROLES[t.filterValues.role].label,
              onRemove: () => t.setFilter('role', ''),
            },
            t.filterValues.status && {
              key: 's',
              label: ACCOUNT_STATUSES[t.filterValues.status].label,
              onRemove: () => t.setFilter('status', ''),
            },
          ].filter(Boolean)}
          onReset={t.resetAll}
        >
          <SearchInput
            value={t.q}
            onChange={t.setQ}
            label="Search administrators"
            placeholder="Name or email"
            className="lg:w-64"
          />
          <SelectField
            label="Role"
            placeholder="All roles"
            options={Object.entries(ADMIN_ROLES).map(([v, r]) => ({ value: v, label: r.label }))}
            value={t.filterValues.role}
            onValueChange={(v) => t.setFilter('role', v)}
          />
          <SelectField
            label="Status"
            placeholder="All"
            options={Object.entries(ACCOUNT_STATUSES).map(([v, s]) => ({ value: v, label: s.label }))}
            value={t.filterValues.status}
            onValueChange={(v) => t.setFilter('status', v)}
          />
        </FilterBar>
        <DataTable
          caption="Administrators"
          loading={isPending}
          error={isError ? error : null}
          onRetry={refetch}
          rows={t.pageItems}
          sort={{ key: t.sortKey, dir: t.sortDir, onSort: t.setSort }}
          empty={{ icon: ShieldCheck, title: 'No administrators match' }}
          columns={[
            {
              key: 'name',
              header: 'Administrator',
              sortKey: 'name',
              cell: (a) => (
                <button
                  type="button"
                  onClick={() => setViewing(a)}
                  className="flex min-w-[13rem] items-center gap-3 text-left"
                >
                  <Avatar name={a.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink hover:text-accent-600">
                      {a.name}
                      {a.id === CURRENT_ADMIN_ID && (
                        <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>
                      )}
                    </span>
                    <span className="block max-w-[16rem] truncate text-xs text-muted">{a.email}</span>
                  </span>
                </button>
              ),
            },
            {
              key: 'role',
              header: 'Role',
              cell: (a) => <Badge tone="accent">{ADMIN_ROLES[a.role].label}</Badge>,
            },
            {
              key: 'status',
              header: 'Status',
              cell: (a) => <StatusBadge status={a.status} map={ACCOUNT_STATUSES} />,
            },
            {
              key: 'login',
              header: 'Last login',
              sortKey: 'lastLoginAt',
              hideBelow: 'md',
              cell: (a) => (
                <span className="whitespace-nowrap text-muted">
                  {a.lastLoginAt ? formatRelative(a.lastLoginAt) : 'Never'}
                </span>
              ),
            },
            {
              key: 'created',
              header: 'Created',
              sortKey: 'createdAt',
              hideBelow: 'lg',
              cell: (a) => <span className="whitespace-nowrap text-muted">{formatDate(a.createdAt)}</span>,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (a) => (
                <DropdownMenu
                  label={`Actions for ${a.name}`}
                  items={menu(a)}
                  trigger={
                    <IconButton label={`Actions for ${a.name}`} icon={MoreHorizontal} tooltip={false} />
                  }
                />
              ),
            },
          ]}
        />
        <Pagination
          page={t.page}
          pageCount={t.pageCount}
          total={t.total}
          from={t.from}
          to={t.to}
          onPageChange={t.setPage}
          label="administrators"
        />
      </Card>

      <Card className="mt-6" padded={false}>
        <div className="p-5 pb-3">
          <CardHeader
            title="Role permission matrix"
            description="What each demo role is intended to allow once the backend enforces it."
            className="!mb-0"
          />
        </div>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Permissions by role</caption>
            <thead>
              <tr className="border-y border-line bg-subtle/60">
                <th
                  scope="col"
                  className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted"
                >
                  Permission
                </th>
                {Object.entries(ADMIN_ROLES).map(([k, r]) => (
                  <th
                    key={k}
                    scope="col"
                    className="px-3 py-2.5 text-center text-xs font-semibold text-muted"
                  >
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERMISSIONS).map(([p, label]) => (
                <tr key={p} className="border-b border-line last:border-0">
                  <th scope="row" className="px-5 py-2.5 text-left font-medium">
                    {label}
                  </th>
                  {Object.entries(ADMIN_ROLES).map(([k, r]) => (
                    <td key={k} className="px-3 py-2.5 text-center">
                      {r.permissions.includes(p) ? (
                        <Check className="mx-auto h-4 w-4 text-success" aria-label="Allowed" />
                      ) : (
                        <span className="text-muted/60" aria-label="Not allowed">
                          —
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <InviteModal open={inviteOpen} onOpenChange={setInviteOpen} />

      <Modal
        open={Boolean(roleTarget)}
        onOpenChange={(o) => !o && setRoleTarget(null)}
        title={`Edit role — ${roleTarget?.name ?? ''}`}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setRoleTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={!roleTarget || newRole === roleTarget.role}
              loading={update.isPending}
              onClick={() => update.mutate({ id: roleTarget.id, changes: { role: newRole } })}
            >
              Save role
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            label="Role"
            options={Object.entries(ADMIN_ROLES).map(([v, r]) => ({ value: v, label: r.label }))}
            value={newRole}
            onValueChange={setNewRole}
          />
          <div>
            <p className="label">Permissions</p>
            <PermissionList role={newRole} />
          </div>
        </div>
      </Modal>

      <Drawer
        open={Boolean(viewing)}
        onOpenChange={(o) => !o && setViewing(null)}
        title={viewing?.name ?? ''}
        description={viewing?.title}
      >
        {viewing && (
          <div className="space-y-5 text-sm">
            <div className="flex items-center gap-3">
              <Avatar name={viewing.name} size="lg" />
              <div>
                <p className="font-semibold">{viewing.email}</p>
                <div className="mt-1 flex gap-2">
                  <Badge tone="accent">{ADMIN_ROLES[viewing.role].label}</Badge>
                  <StatusBadge status={viewing.status} map={ACCOUNT_STATUSES} />
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted">Last login</dt>
                <dd>{viewing.lastLoginAt ? formatRelative(viewing.lastLoginAt) : 'Never'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Created</dt>
                <dd>{formatDate(viewing.createdAt)}</dd>
              </div>
            </dl>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Permissions</p>
              <PermissionList role={viewing.role} />
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
