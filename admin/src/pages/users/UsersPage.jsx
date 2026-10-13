import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Eye, MoreHorizontal, RotateCcw, UserCog, Users } from 'lucide-react';
import { useApiQuery } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useTableState';
import { getUsers } from '@/services/userService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { IconButton } from '@/components/common/IconButton';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { FilterBar } from '@/components/common/FilterBar';
import { SearchInput, SelectField } from '@/components/common/Fields';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import { StatusBadge, Badge } from '@/components/common/Badge';
import { Avatar } from '@/components/common/Avatar';
import { DemoNotice } from '@/components/common/States';
import { useUserActions } from '@/components/users/UserActions';
import { USER_ROLES, ACCOUNT_STATUSES } from '@/utils/constants';
import { formatDate, formatRelative } from '@/utils/formatDate';

export default function UsersPage() {
  const { data: users = [], isPending, isError, error, refetch } = useApiQuery('users', getUsers);
  const actions = useUserActions();

  const config = useMemo(
    () => ({
      searchFields: (u) => [u.name, u.email, u.organisation],
      filters: { role: (u, v) => u.role === v, status: (u, v) => u.status === v },
      dateField: 'createdAt',
      sorters: {
        name: (u) => u.name,
        createdAt: (u) => new Date(u.createdAt).getTime(),
        lastActiveAt: (u) => new Date(u.lastActiveAt).getTime(),
        listings: (u) => u.listingCount,
      },
      defaultSort: { key: 'lastActiveAt', dir: 'desc' },
    }),
    [],
  );
  const t = useTableState(users, config);

  const menu = (u) => [
    { label: 'View profile', icon: Eye, to: `/users/${u.id}` },
    { label: 'Change role', icon: UserCog, onSelect: () => actions.openRole(u) },
    u.status === 'active'
      ? {
          label: 'Suspend account',
          icon: Ban,
          tone: 'danger',
          separatorBefore: true,
          onSelect: () => actions.changeStatus(u, 'suspended'),
        }
      : {
          label: 'Reactivate account',
          icon: RotateCcw,
          separatorBefore: true,
          onSelect: () => actions.changeStatus(u, 'active'),
        },
  ];

  return (
    <>
      <PageHeader title="Users" description="Visitors, business owners and staff with platform accounts." />
      <DemoNotice className="mb-5">
        Example users and roles. Status and role changes affect this browser’s demo data only — no real
        accounts exist yet.
      </DemoNotice>
      <Card padded={false}>
        <FilterBar
          chips={[
            t.q && { key: 'q', label: `Search: “${t.q}”`, onRemove: () => t.setQ('') },
            t.filterValues.role && {
              key: 'r',
              label: USER_ROLES[t.filterValues.role],
              onRemove: () => t.setFilter('role', ''),
            },
            t.filterValues.status && {
              key: 's',
              label: ACCOUNT_STATUSES[t.filterValues.status].label,
              onRemove: () => t.setFilter('status', ''),
            },
            (t.dateFrom || t.dateTo) && {
              key: 'd',
              label: 'Registration period',
              onRemove: () => t.setDateRange('', ''),
            },
          ].filter(Boolean)}
          onReset={t.resetAll}
        >
          <SearchInput
            value={t.q}
            onChange={t.setQ}
            label="Search users"
            placeholder="Name or email"
            className="lg:w-64"
          />
          <SelectField
            label="Role"
            placeholder="All roles"
            options={Object.entries(USER_ROLES).map(([v, l]) => ({ value: v, label: l }))}
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
          <DateRangePicker label="Registered" from={t.dateFrom} to={t.dateTo} onChange={t.setDateRange} />
        </FilterBar>
        <DataTable
          caption="Platform users"
          loading={isPending}
          error={isError ? error : null}
          onRetry={refetch}
          rows={t.pageItems}
          sort={{ key: t.sortKey, dir: t.sortDir, onSort: t.setSort }}
          empty={{ icon: Users, title: 'No users match your filters' }}
          columns={[
            {
              key: 'name',
              header: 'User',
              sortKey: 'name',
              cell: (u) => (
                <Link to={`/users/${u.id}`} className="flex min-w-[13rem] items-center gap-3">
                  <Avatar name={u.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink hover:text-accent-600">
                      {u.name}
                    </span>
                    <span className="block max-w-[16rem] truncate text-xs text-muted">{u.email}</span>
                  </span>
                </Link>
              ),
            },
            { key: 'role', header: 'Role', cell: (u) => <Badge>{USER_ROLES[u.role]}</Badge> },
            {
              key: 'status',
              header: 'Status',
              cell: (u) => <StatusBadge status={u.status} map={ACCOUNT_STATUSES} />,
            },
            {
              key: 'registered',
              header: 'Registered',
              sortKey: 'createdAt',
              hideBelow: 'lg',
              cell: (u) => <span className="whitespace-nowrap text-muted">{formatDate(u.createdAt)}</span>,
            },
            {
              key: 'active',
              header: 'Last activity',
              sortKey: 'lastActiveAt',
              hideBelow: 'md',
              cell: (u) => (
                <span className="whitespace-nowrap text-muted">{formatRelative(u.lastActiveAt)}</span>
              ),
            },
            {
              key: 'listings',
              header: 'Listings',
              sortKey: 'listings',
              align: 'right',
              hideBelow: 'sm',
              cell: (u) => u.listingCount,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (u) => (
                <DropdownMenu
                  label={`Actions for ${u.name}`}
                  items={menu(u)}
                  trigger={
                    <IconButton label={`Actions for ${u.name}`} icon={MoreHorizontal} tooltip={false} />
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
          label="users"
        />
      </Card>
      {actions.roleModal}
    </>
  );
}
