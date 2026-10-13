import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  FileEdit,
  FilePlus2,
  FileText,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useTableState';
import { useLookups } from '@/hooks/useLookups';
import {
  getKnowledgeDocuments,
  getSyncJobs,
  queueDocumentIndexing,
  deleteKnowledgeDocument,
  createKnowledgeDocument,
} from '@/services/knowledgeService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { FilterBar } from '@/components/common/FilterBar';
import { SearchInput, SelectField } from '@/components/common/Fields';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import { StatusBadge } from '@/components/common/Badge';
import { StatCard } from '@/components/common/StatCard';
import { Modal } from '@/components/common/Modal';
import { FileUpload } from '@/components/common/FileUpload';
import { ContentPreview } from '@/components/common/ContentPreview';
import { DemoNotice, Skeleton } from '@/components/common/States';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { INDEXING_STATUSES, PUBLICATION_STATUSES, SOURCE_TYPES } from '@/utils/constants';
import { formatDate, formatRelative } from '@/utils/formatDate';

const ACCEPT = {
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/csv': ['.csv'],
};

export function useDocumentActions() {
  const confirm = useConfirm();
  const queue = useApiMutation(({ id, op }) => queueDocumentIndexing(id, op), {
    invalidate: [['documents'], ['document'], ['syncJobs']],
    success: (job, v) => `${v.op === 'retry' ? 'Retry' : 'Reindex'} queued (${job.id}) — simulated`,
    error: 'Couldn’t queue indexing',
  });
  const remove = useApiMutation((id) => deleteKnowledgeDocument(id), {
    invalidate: [['documents']],
    success: 'Document deleted',
    error: 'Delete failed',
  });
  return {
    queue: (d, op = 'reindex') => queue.mutate({ id: d.id, op }),
    remove: async (d, onDone) => {
      if (
        await confirm({
          title: `Delete “${d.title}”?`,
          message: 'It will be removed from the knowledge base and excluded from the chatbot (simulated).',
          confirmLabel: 'Delete',
          tone: 'danger',
        })
      ) {
        remove.mutate(d.id, { onSuccess: onDone });
      }
    },
    busy: queue.isPending || remove.isPending,
  };
}

export default function KnowledgeBasePage() {
  const {
    data: docs = [],
    isPending,
    isError,
    error,
    refetch,
  } = useApiQuery('documents', getKnowledgeDocuments);
  const jobs = useApiQuery('syncJobs', getSyncJobs);
  const { categoryName, categories } = useLookups();
  const actions = useDocumentActions();
  const [preview, setPreview] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [files, setFiles] = useState([]);

  const config = useMemo(
    () => ({
      searchFields: (d) => [d.title, d.summary, categoryName(d.categoryId), d.tags.join(' ')],
      filters: {
        source: (d, v) => d.sourceType === v,
        status: (d, v) => d.status === v,
        indexing: (d, v) => d.indexingStatus === v,
        category: (d, v) => d.categoryId === v,
      },
      dateField: 'updatedAt',
      sorters: {
        title: (d) => d.title,
        updatedAt: (d) => new Date(d.updatedAt).getTime(),
        lastIndexedAt: (d) => (d.lastIndexedAt ? new Date(d.lastIndexedAt).getTime() : 0),
      },
      defaultSort: { key: 'updatedAt', dir: 'desc' },
    }),
    [categoryName],
  );
  const t = useTableState(docs, config);

  const createFromFiles = useApiMutation(
    async (list) => {
      for (const f of list) {
        await createKnowledgeDocument({
          title: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
          summary: 'Draft created from a selected file (demo — the file was not uploaded).',
          content: '(File contents will be extracted by the backend file-processing service once connected.)',
          sourceType: 'upload',
          categoryId: null,
          locationId: null,
          tags: [],
          status: 'draft',
          includeInChatbot: false,
          visibility: 'public',
          requiresApproval: true,
          file: { name: f.name, size: f.size, type: f.type },
        });
      }
      return list.length;
    },
    {
      invalidate: [['documents']],
      success: (n) => `${n} draft document(s) created — files were not uploaded (demo)`,
      error: 'Couldn’t create drafts',
      onSuccess: () => {
        setFiles([]);
        setUploadOpen(false);
      },
    },
  );

  const count = (pred) => docs.filter(pred).length;
  const lastCompleted = (jobs.data ?? [])
    .filter((j) => j.status === 'completed')
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];

  const menu = (d) =>
    [
      { label: 'View details', icon: Eye, to: `/knowledge/${d.id}` },
      { label: 'Edit', icon: Pencil, to: `/knowledge/${d.id}/edit` },
      { label: 'Preview content', icon: FileText, onSelect: () => setPreview(d) },
      d.indexingStatus === 'failed' && {
        label: 'Retry indexing',
        icon: RotateCcw,
        onSelect: () => actions.queue(d, 'retry'),
        separatorBefore: true,
      },
      d.status === 'published' &&
        d.includeInChatbot &&
        d.indexingStatus !== 'failed' && {
          label: 'Reindex',
          icon: RefreshCw,
          onSelect: () => actions.queue(d),
          separatorBefore: true,
        },
      {
        label: 'Delete',
        icon: Trash2,
        tone: 'danger',
        separatorBefore: true,
        onSelect: () => actions.remove(d),
      },
    ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Knowledge base"
        description="Approved content the AI assistant may use to answer questions."
        actions={
          <>
            <Button variant="outline" icon={Upload} onClick={() => setUploadOpen(true)}>
              Upload documents
            </Button>
            <Button icon={FilePlus2} to="/knowledge/new">
              New document
            </Button>
          </>
        }
      />
      <DemoNotice className="mb-5">
        Indexing statuses are simulated. Real chunking, embedding and indexing will run in the Node.js
        backend.
      </DemoNotice>

      <section
        aria-label="Knowledge metrics"
        className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
      >
        {isPending ? (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[112px] rounded-card" />)
        ) : (
          <>
            <StatCard label="Total documents" value={docs.length} icon={BookOpen} />
            <StatCard
              label="Published"
              value={count((d) => d.status === 'published')}
              icon={CheckCircle2}
              tone="success"
              to="/knowledge?status=published"
            />
            <StatCard
              label="Drafts"
              value={count((d) => d.status === 'draft')}
              icon={FileEdit}
              tone="navy"
              to="/knowledge?status=draft"
            />
            <StatCard
              label="Pending indexing"
              value={count((d) => ['pending', 'processing'].includes(d.indexingStatus))}
              icon={Clock}
              tone="warning"
              to="/knowledge?indexing=pending"
            />
            <StatCard
              label="Failed indexing"
              value={count((d) => d.indexingStatus === 'failed')}
              icon={AlertTriangle}
              tone="danger"
              to="/knowledge?indexing=failed"
            />
            <StatCard
              label="Last mock sync"
              value={lastCompleted ? formatRelative(lastCompleted.completedAt) : '—'}
              icon={RefreshCw}
              tone="info"
              hint="Simulated"
              to="/knowledge/sync"
            />
          </>
        )}
      </section>

      <Card padded={false}>
        <FilterBar
          chips={[
            t.q && { key: 'q', label: `Search: “${t.q}”`, onRemove: () => t.setQ('') },
            t.filterValues.source && {
              key: 's',
              label: SOURCE_TYPES[t.filterValues.source],
              onRemove: () => t.setFilter('source', ''),
            },
            t.filterValues.status && {
              key: 'p',
              label: PUBLICATION_STATUSES[t.filterValues.status]?.label,
              onRemove: () => t.setFilter('status', ''),
            },
            t.filterValues.indexing && {
              key: 'i',
              label: `Indexing: ${INDEXING_STATUSES[t.filterValues.indexing]?.label}`,
              onRemove: () => t.setFilter('indexing', ''),
            },
            t.filterValues.category && {
              key: 'c',
              label: categoryName(t.filterValues.category),
              onRemove: () => t.setFilter('category', ''),
            },
            (t.dateFrom || t.dateTo) && {
              key: 'd',
              label: 'Updated date',
              onRemove: () => t.setDateRange('', ''),
            },
          ].filter(Boolean)}
          onReset={t.resetAll}
        >
          <SearchInput
            value={t.q}
            onChange={t.setQ}
            label="Search documents"
            placeholder="Title, category or summary"
            className="lg:w-64"
          />
          <SelectField
            label="Source type"
            placeholder="All sources"
            options={Object.entries(SOURCE_TYPES).map(([v, l]) => ({ value: v, label: l }))}
            value={t.filterValues.source}
            onValueChange={(v) => t.setFilter('source', v)}
          />
          <SelectField
            label="Publication"
            placeholder="All"
            options={Object.entries(PUBLICATION_STATUSES).map(([v, s]) => ({ value: v, label: s.label }))}
            value={t.filterValues.status}
            onValueChange={(v) => t.setFilter('status', v)}
          />
          <SelectField
            label="Indexing"
            placeholder="All"
            options={Object.entries(INDEXING_STATUSES).map(([v, s]) => ({ value: v, label: s.label }))}
            value={t.filterValues.indexing}
            onValueChange={(v) => t.setFilter('indexing', v)}
          />
          <SelectField
            label="Category"
            placeholder="All"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={t.filterValues.category}
            onValueChange={(v) => t.setFilter('category', v)}
          />
          <DateRangePicker label="Updated" from={t.dateFrom} to={t.dateTo} onChange={t.setDateRange} />
        </FilterBar>
        <DataTable
          caption="Knowledge documents"
          loading={isPending}
          error={isError ? error : null}
          onRetry={refetch}
          rows={t.pageItems}
          rowLabel={(d) => d.title}
          sort={{ key: t.sortKey, dir: t.sortDir, onSort: t.setSort }}
          empty={{
            icon: BookOpen,
            title: docs.length ? 'No documents match your filters' : 'No knowledge documents yet',
            action: docs.length ? (
              <Button size="sm" variant="outline" onClick={t.resetAll}>
                Reset filters
              </Button>
            ) : (
              <Button size="sm" to="/knowledge/new">
                New document
              </Button>
            ),
          }}
          columns={[
            {
              key: 'title',
              header: 'Document',
              sortKey: 'title',
              cell: (d) => (
                <div className="min-w-[14rem] max-w-md">
                  <Link
                    to={`/knowledge/${d.id}`}
                    className="block truncate font-medium text-ink hover:text-accent-600"
                  >
                    {d.title}
                  </Link>
                  <p className="truncate text-xs text-muted">{d.summary}</p>
                </div>
              ),
            },
            {
              key: 'source',
              header: 'Source',
              hideBelow: 'md',
              cell: (d) => <span className="whitespace-nowrap text-muted">{SOURCE_TYPES[d.sourceType]}</span>,
            },
            {
              key: 'category',
              header: 'Category',
              hideBelow: '2xl',
              cell: (d) => (
                <span className="whitespace-nowrap text-muted">
                  {d.categoryId ? categoryName(d.categoryId) : 'General'}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (d) => <StatusBadge status={d.status} map={PUBLICATION_STATUSES} />,
            },
            {
              key: 'updated',
              header: 'Updated',
              sortKey: 'updatedAt',
              hideBelow: 'lg',
              cell: (d) => <span className="whitespace-nowrap text-muted">{formatDate(d.updatedAt)}</span>,
            },
            {
              key: 'indexing',
              header: 'Indexing',
              cell: (d) => <StatusBadge status={d.indexingStatus} map={INDEXING_STATUSES} />,
            },
            {
              key: 'indexed',
              header: 'Last indexed',
              sortKey: 'lastIndexedAt',
              hideBelow: '2xl',
              cell: (d) => (
                <span className="whitespace-nowrap text-muted">
                  {d.lastIndexedAt ? formatRelative(d.lastIndexedAt) : 'Never'}
                </span>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (d) => (
                <DropdownMenu
                  label={`Actions for ${d.title}`}
                  items={menu(d)}
                  trigger={
                    <IconButton label={`Actions for ${d.title}`} icon={MoreHorizontal} tooltip={false} />
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
          label="documents"
        />
      </Card>

      <Modal
        open={Boolean(preview)}
        onOpenChange={(o) => !o && setPreview(null)}
        title={preview?.title ?? ''}
        description={preview?.summary}
        size="lg"
        footer={
          preview && (
            <Button to={`/knowledge/${preview.id}/edit`} icon={Pencil}>
              Edit document
            </Button>
          )
        }
      >
        {preview && <ContentPreview content={preview.content} />}
      </Modal>

      <Modal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        title="Upload knowledge documents"
        description="PDF, TXT, DOCX or CSV, up to 10 MB each."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!files.length}
              loading={createFromFiles.isPending}
              onClick={() => createFromFiles.mutate(files)}
            >
              Create {files.length || ''} draft record{files.length === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        <FileUpload
          accept={ACCEPT}
          maxSizeMb={10}
          files={files}
          onChange={setFiles}
          label="Choose documents"
        />
        <DemoNotice className="mt-4">
          Files are validated in your browser only. They are not uploaded, parsed or indexed — a draft record
          is created with the file’s name and size so you can try the workflow.
        </DemoNotice>
      </Modal>
    </>
  );
}
