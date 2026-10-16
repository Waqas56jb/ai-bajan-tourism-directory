import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bot, FileText, Pencil, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { useLookups } from '@/hooks/useLookups';
import { usePageTitle } from '@/context/PageMetaContext';
import { getKnowledgeDocumentById, updateKnowledgeDocument, getFaqs } from '@/services/knowledgeService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { StatusBadge, DemoBadge, Badge } from '@/components/common/Badge';
import { Toggle } from '@/components/common/Toggle';
import { ContentPreview } from '@/components/common/ContentPreview';
import { DemoNotice, ErrorState, PageLoading, EmptyState } from '@/components/common/States';
import {
  INDEXING_STATUSES,
  PUBLICATION_STATUSES,
  SOURCE_TYPES,
  SYNC_OPERATIONS,
  SYNC_STATUSES,
} from '@/utils/constants';
import { formatDate, formatDateTime, formatRelative } from '@/utils/formatDate';
import { formatBytes } from '@/utils/formatNumber';
import { useDocumentActions } from './KnowledgeBasePage';
import NotFoundPage from '@/pages/errors/NotFoundPage';

/** Barbados Trusted Information Network tiers (highest first), as ranked by the assistant. */
const SOURCE_TIERS = {
  verified: '0 · AI Bajan team-verified answer (highest)',
  official: '1 · Official government source',
  institutional: '2 · Barbadian institution',
  local: '3 · AI Bajan verified information',
  publication: '4 · Local publication',
  background: '5 · General background (lowest)',
};

export default function KnowledgeDocumentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const lookups = useLookups();
  const {
    data: d,
    isPending,
    isError,
    error,
    refetch,
  } = useApiQuery(['document', id], () => getKnowledgeDocumentById(id));
  const faqs = useApiQuery('faqs', getFaqs);
  const actions = useDocumentActions();
  usePageTitle(d?.title);

  const update = useApiMutation((changes) => updateKnowledgeDocument(id, changes), {
    invalidate: [['documents'], ['document'], ['syncJobs']],
    success: (doc) => `Updated “${doc.title}”`,
    error: 'Update failed',
  });

  if (isError && error?.status === 404)
    return <NotFoundPage title="Document not found" backTo="/knowledge" backLabel="Back to knowledge base" />;
  if (isError)
    return (
      <Card>
        <ErrorState message={error?.message} onRetry={refetch} />
      </Card>
    );
  if (isPending) return <PageLoading />;

  const relatedFaq = (faqs.data ?? []).find((f) => f.id === d.relatedFaqId);
  const relatedListing = lookups.listingById[d.relatedListingId];

  return (
    <>
      <PageHeader
        title={d.title}
        setTitle={false}
        badge={<StatusBadge status={d.status} map={PUBLICATION_STATUSES} />}
        description={d.summary}
        actions={
          <>
            {d.indexingStatus === 'failed' ? (
              <Button
                variant="outline"
                icon={RotateCcw}
                onClick={() => actions.queue(d, 'retry')}
                disabled={actions.busy}
              >
                Retry indexing
              </Button>
            ) : (
              <Button
                variant="outline"
                icon={RefreshCw}
                onClick={() => actions.queue(d)}
                disabled={actions.busy || d.status !== 'published' || !d.includeInChatbot}
              >
                Reindex
              </Button>
            )}
            <Button
              variant="outline"
              icon={Trash2}
              onClick={() => actions.remove(d, () => navigate('/knowledge'))}
            >
              Delete
            </Button>
            <Button icon={Pencil} to={`/knowledge/${d.id}/edit`}>
              Edit
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Content preview" />
          {d.file && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-subtle/50 px-3 py-2.5 text-sm">
              <FileText className="h-4 w-4 text-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium">{d.file.name}</span>
              <span className="text-xs text-muted">{formatBytes(d.file.size)}</span>
            </div>
          )}
          <ContentPreview content={d.content} />
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Publishing" />
            <div className="space-y-4">
              <Toggle
                label="Include in chatbot"
                description={
                  d.visibility === 'internal'
                    ? 'Internal documents can’t be used by the chatbot.'
                    : 'Only published documents are indexed.'
                }
                checked={d.includeInChatbot}
                disabled={update.isPending || d.visibility === 'internal'}
                onChange={(v) => update.mutate({ includeInChatbot: v })}
              />
              <div className="flex flex-wrap gap-2">
                {d.status !== 'published' && (
                  <Button
                    size="sm"
                    variant="accent"
                    disabled={update.isPending}
                    onClick={() => update.mutate({ status: 'published' })}
                  >
                    Publish
                  </Button>
                )}
                {d.status === 'published' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={update.isPending}
                    onClick={() => update.mutate({ status: 'draft' })}
                  >
                    Unpublish
                  </Button>
                )}
                {d.status !== 'archived' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={update.isPending}
                    onClick={() => update.mutate({ status: 'archived' })}
                  >
                    Archive
                  </Button>
                )}
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted">Source type</dt>
                <dd>{SOURCE_TYPES[d.sourceType]}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Visibility</dt>
                <dd>{d.visibility === 'internal' ? 'Internal only' : 'Public'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Category</dt>
                <dd>{d.categoryId ? lookups.categoryName(d.categoryId) : 'General'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Location</dt>
                <dd>{d.locationId ? lookups.locationName(d.locationId) : 'Island-wide'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Last modified</dt>
                <dd>{formatDateTime(d.updatedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Created</dt>
                <dd>{formatDateTime(d.createdAt)}</dd>
              </div>
              {d.sourceUrl && (
                <>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted">Original web page</dt>
                    <dd className="break-all">
                      <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent-600 hover:underline">{d.sourceUrl}</a>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Source priority</dt>
                    <dd>{SOURCE_TIERS[d.sourceTier] ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Page last updated</dt>
                    <dd>{d.sourceUpdatedAt ? formatDate(d.sourceUpdatedAt) : 'Not stated on the page'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Last checked for changes</dt>
                    <dd>{d.lastCheckedAt ? formatRelative(d.lastCheckedAt) : 'Not yet'}</dd>
                  </div>
                </>
              )}
            </dl>
            {d.tags.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {d.tags.map((t) => (
                  <li key={t}>
                    <Badge>{t}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {(relatedListing || relatedFaq) && (
              <div className="mt-4 space-y-1 text-sm">
                {relatedListing && (
                  <p>
                    Related listing:{' '}
                    <Link
                      to={`/listings/${relatedListing.id}`}
                      className="font-medium text-accent-600 hover:underline"
                    >
                      {relatedListing.name}
                    </Link>
                  </p>
                )}
                {relatedFaq && (
                  <p>
                    Related FAQ:{' '}
                    <Link
                      to={`/knowledge/faqs?edit=${relatedFaq.id}`}
                      className="font-medium text-accent-600 hover:underline"
                    >
                      {relatedFaq.question}
                    </Link>
                  </p>
                )}
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Indexing" badge={<DemoBadge>Simulated</DemoBadge>} />
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted">Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={d.indexingStatus} map={INDEXING_STATUSES} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Last indexed</dt>
                <dd className="mt-1">{d.lastIndexedAt ? formatRelative(d.lastIndexedAt) : 'Never'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Sample chunk count</dt>
                <dd className="mt-1">{d.chunkCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Chatbot use</dt>
                <dd className="mt-1 inline-flex items-center gap-1">
                  <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                  {d.includeInChatbot && d.status === 'published' ? 'Eligible' : 'Not used'}
                </dd>
              </div>
            </dl>
            <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
              Sample indexing log
            </h3>
            {d.jobs.length ? (
              <ul className="space-y-3">
                {d.jobs.map((j) => (
                  <li key={j.id} className="rounded-xl border border-line p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {j.id} · {SYNC_OPERATIONS[j.operation]}
                      </span>
                      <StatusBadge status={j.status} map={SYNC_STATUSES} />
                    </div>
                    <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-muted">
                      {j.log.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ol>
                    {j.errorSummary && <p className="mt-2 text-danger">{j.errorSummary}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No indexing jobs yet" />
            )}
            <DemoNotice className="mt-4">
              Real indexing will be enabled after the Node.js backend integration. No vector IDs or real
              results are shown here.
            </DemoNotice>
          </Card>
        </div>
      </div>
    </>
  );
}
