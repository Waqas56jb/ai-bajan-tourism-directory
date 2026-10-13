import { Link, useParams } from 'react-router-dom';
import { Ban, Mail, RotateCcw, UserCog } from 'lucide-react';
import { useApiQuery } from '@/hooks/useApi';
import { usePageTitle } from '@/context/PageMetaContext';
import { getUserById } from '@/services/userService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge, Badge } from '@/components/common/Badge';
import { DemoNotice, EmptyState, ErrorState, PageLoading } from '@/components/common/States';
import { ListingStatusBadge, ListingThumb } from '@/components/listings/ListingStatusBadge';
import { useUserActions } from '@/components/users/UserActions';
import { ACCOUNT_STATUSES, USER_ROLES } from '@/utils/constants';
import { ACTIVITY_ACTIONS } from '@/data/mockActivity';
import { formatDate, formatDateTime, formatRelative } from '@/utils/formatDate';
import NotFoundPage from '@/pages/errors/NotFoundPage';

export default function UserDetailsPage() {
  const { id } = useParams();
  const { data: u, isPending, isError, error, refetch } = useApiQuery(['user', id], () => getUserById(id));
  const actions = useUserActions();
  usePageTitle(u?.name);

  if (isError && error?.status === 404)
    return <NotFoundPage title="User not found" backTo="/users" backLabel="Back to users" />;
  if (isError)
    return (
      <Card>
        <ErrorState message={error?.message} onRetry={refetch} />
      </Card>
    );
  if (isPending) return <PageLoading />;

  const submissions = u.listings.filter(
    (l) => l.submittedBy === u.id || ['pending', 'rejected'].includes(l.status),
  );

  return (
    <>
      <PageHeader
        title={u.name}
        setTitle={false}
        badge={<StatusBadge status={u.status} map={ACCOUNT_STATUSES} />}
        description={`${USER_ROLES[u.role]}${u.organisation ? ` · ${u.organisation}` : ''}`}
        actions={
          <>
            <Button variant="outline" icon={UserCog} onClick={() => actions.openRole(u)}>
              Change role
            </Button>
            {u.status === 'active' ? (
              <Button
                variant="destructive-outline"
                icon={Ban}
                onClick={() => actions.changeStatus(u, 'suspended')}
              >
                Suspend
              </Button>
            ) : (
              <Button variant="accent" icon={RotateCcw} onClick={() => actions.changeStatus(u, 'active')}>
                Reactivate
              </Button>
            )}
          </>
        }
      />
      <DemoNotice className="mb-5">
        Demo profile — changes don’t affect any real account until backend authorization is integrated.
      </DemoNotice>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <div className="flex flex-col items-center text-center">
            <Avatar name={u.name} size="xl" />
            <p className="mt-3 text-base font-semibold">{u.name}</p>
            <a
              href={`mailto:${u.email}`}
              className="mt-0.5 inline-flex items-center gap-1 break-all text-sm text-accent-600 hover:underline"
            >
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {u.email}
            </a>
            <Badge className="mt-3">{USER_ROLES[u.role]}</Badge>
          </div>
          <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
            {[
              ['Account status', ACCOUNT_STATUSES[u.status].label],
              ['Organisation', u.organisation ?? '—'],
              ['Registered', formatDateTime(u.createdAt)],
              ['Last updated', formatDateTime(u.updatedAt)],
              ['Last activity', formatRelative(u.lastActiveAt)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {u.note && <p className="mt-4 rounded-lg bg-danger/5 p-3 text-xs text-danger">{u.note}</p>}
        </Card>
        <div className="space-y-6">
          <Card padded={false}>
            <div className="p-5 pb-3">
              <CardHeader
                title={`Associated listings (${u.listings.length})`}
                className="!mb-0"
                actions={
                  u.listings.length > 0 && (
                    <Button size="sm" variant="ghost" to="/listings">
                      All listings
                    </Button>
                  )
                }
              />
            </div>
            {u.listings.length ? (
              <ul className="divide-y divide-line border-t border-line">
                {u.listings.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                    <ListingThumb listing={l} />
                    <Link
                      to={`/listings/${l.id}`}
                      className="min-w-0 flex-1 truncate font-medium hover:text-accent-600"
                    >
                      {l.name}
                    </Link>
                    <ListingStatusBadge status={l.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No associated listings" />
            )}
          </Card>
          <Card>
            <CardHeader title="Submission history" />
            {submissions.length ? (
              <ul className="space-y-2 text-sm">
                {submissions.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
                  >
                    <Link
                      to={l.status === 'pending' ? '/listings/submissions' : `/listings/${l.id}`}
                      className="font-medium hover:text-accent-600"
                    >
                      {l.name}
                    </Link>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      {l.submittedAt ? formatDate(l.submittedAt) : formatDate(l.createdAt)}{' '}
                      <ListingStatusBadge status={l.status} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No submissions from this user.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Activity history" />
            {u.activity.length ? (
              <ol className="space-y-2 text-sm">
                {u.activity.map((e) => (
                  <li key={e.id} className="flex flex-wrap justify-between gap-2">
                    <span>
                      <span className="font-medium">{ACTIVITY_ACTIONS[e.action]}</span>{' '}
                      <span className="text-muted">— {e.entityName}</span>
                    </span>
                    <span className="text-xs text-muted">{formatRelative(e.at)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">No recorded activity.</p>
            )}
          </Card>
        </div>
      </div>
      {actions.roleModal}
    </>
  );
}
