import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bot, Eye, HelpCircle, MoreHorizontal, Pencil, Plus, Send, Trash2, Undo2 } from 'lucide-react';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { useTableState } from '@/hooks/useTableState';
import { useLookups } from '@/hooks/useLookups';
import { getFaqs, createFaq, updateFaq, deleteFaq, bulkSetFaqStatus } from '@/services/knowledgeService';
import { getChatbotSettings } from '@/services/chatbotService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { DataTable } from '@/components/common/DataTable';
import { Pagination } from '@/components/common/Pagination';
import { FilterBar } from '@/components/common/FilterBar';
import { SearchInput, SelectField, TextField, TextAreaField } from '@/components/common/Fields';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import { StatusBadge, Badge } from '@/components/common/Badge';
import { Drawer, Modal } from '@/components/common/Modal';
import { Toggle } from '@/components/common/Toggle';
import { TagInput } from '@/components/common/TagInput';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { ChatbotPreview } from '@/components/chatbot/ChatbotPreview';
import { PUBLICATION_STATUSES } from '@/utils/constants';
import { formatDate } from '@/utils/formatDate';

const schema = z
  .object({
    question: z.string().trim().max(200, 'Keep questions under 200 characters.'),
    answer: z.string().trim().max(1500, 'Keep answers under 1,500 characters.'),
    categoryId: z.string(),
    locationId: z.string(),
    listingId: z.string(),
    tags: z.array(z.string()),
    status: z.enum(['draft', 'review', 'published', 'archived']),
    includeInChatbot: z.boolean(),
    order: z.coerce.number().int().min(1).max(999),
    sourceUrl: z.string().trim().max(500).refine((u) => !u || /^https?:\/\/\S+\.\S+/i.test(u), 'Enter the full web address, starting with https://'),
    sourceTitle: z.string().trim().max(200),
    reviewDue: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!v.question) ctx.addIssue({ path: ['question'], code: 'custom', message: 'A question is required.' });
    if (v.status === 'published' && !v.answer)
      ctx.addIssue({ path: ['answer'], code: 'custom', message: 'Published FAQs need an answer.' });
    if (v.status === 'published' && !v.sourceUrl)
      ctx.addIssue({ path: ['sourceUrl'], code: 'custom', message: 'Published answers need a supporting source: the page this answer is based on.' });
  });

function FaqEditor({ faq, open, onOpenChange, nextOrder }) {
  const editing = Boolean(faq?.id);
  const { categories, locations, listings, categoryName } = useLookups();
  const settings = useApiQuery('chatbotSettings', getChatbotSettings);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });
  const v = useWatch({ control });

  useEffect(() => {
    if (open)
      reset({
        question: faq?.question ?? '',
        answer: faq?.answer ?? '',
        categoryId: faq?.categoryId ?? '',
        locationId: faq?.locationId ?? '',
        listingId: faq?.listingId ?? '',
        tags: faq?.tags ?? [],
        status: faq?.status ?? 'draft',
        includeInChatbot: faq?.includeInChatbot ?? true,
        order: faq?.order ?? nextOrder,
        sourceUrl: faq?.sourceUrl ?? '',
        sourceTitle: faq?.sourceTitle ?? '',
        reviewDue: faq?.reviewDue ?? '',
      });
  }, [open, faq, nextOrder, reset]);

  const save = useApiMutation((values) => (editing ? updateFaq(faq.id, values) : createFaq(values)), {
    invalidate: [['faqs']],
    success: (f) => `${editing ? 'Saved' : 'Created'} FAQ “${f.question}”`,
    error: 'Couldn’t save the FAQ',
    onSuccess: () => onOpenChange(false),
  });

  // Apply the target status *before* validation so publish rules (answer required) run inline.
  const submit = (status) => (e) => {
    if (status) setValue('status', status);
    return handleSubmit((values) =>
      save.mutate({
        ...values,
        categoryId: values.categoryId || null,
        locationId: values.locationId || null,
        listingId: values.listingId || null,
      }),
    )(e);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit FAQ' : 'New FAQ'}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={submit()} loading={save.isPending}>
            Save
          </Button>
          <Button icon={Send} onClick={submit('published')} disabled={save.isPending}>
            Save and publish
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <form noValidate onSubmit={(e) => e.preventDefault()} className="space-y-4">
          <TextField
            label="Question"
            required
            maxLength={200}
            value={v.question}
            error={errors.question?.message}
            {...register('question')}
          />
          <TextAreaField
            label="Answer"
            rows={6}
            maxLength={1500}
            value={v.answer}
            error={errors.answer?.message}
            helper="Required before publishing."
            {...register('answer')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Category"
              placeholder="General"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              {...register('categoryId')}
            />
            <SelectField
              label="Related location"
              placeholder="None"
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              {...register('locationId')}
            />
            <SelectField
              label="Related listing"
              placeholder="None"
              options={listings.map((l) => ({ value: l.id, label: l.name }))}
              {...register('listingId')}
            />
            <TextField
              label="Display order"
              type="number"
              min={1}
              error={errors.order?.message}
              {...register('order')}
            />
            <SelectField
              label="Publication status"
              options={Object.entries(PUBLICATION_STATUSES).map(([k, s]) => ({ value: k, label: s.label }))}
              {...register('status')}
            />
          </div>
          <div className="space-y-3 rounded-xl bg-subtle p-4">
            <p className="text-sm font-semibold text-ink">Verification</p>
            <TextField
              label="Supporting source (web address)"
              placeholder="https://www.gov.bb/…"
              helper="The page this answer is based on. Required to publish; it is cited with the answer."
              error={errors.sourceUrl?.message}
              {...register('sourceUrl')}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Source name" placeholder="e.g. Barbados Water Authority – Contact us" {...register('sourceTitle')} />
              <TextField label="Review by" type="date" helper="Defaults to six months after approval." {...register('reviewDue')} />
            </div>
            {editing && faq?.approvedAt && (
              <p className="text-xs text-muted">
                Approved {faq.approvedBy ? `by ${faq.approvedBy} ` : ''}on {formatDate(faq.approvedAt)}.
                {faq.reviewOverdue ? ' Review is overdue: the answer no longer overrides other sources until it is re-approved.' : ''}
              </p>
            )}
          </div>
          <Controller
            control={control}
            name="tags"
            render={({ field }) => (
              <TagInput label="Tags" value={field.value ?? []} onChange={field.onChange} />
            )}
          />
          <Controller
            control={control}
            name="includeInChatbot"
            render={({ field }) => (
              <Toggle
                label="Include in chatbot knowledge"
                description="Only published FAQs are used."
                checked={Boolean(field.value)}
                onChange={field.onChange}
              />
            )}
          />
        </form>
        <div>
          <p className="label flex items-center gap-1.5">
            <Bot className="h-4 w-4 text-accent" aria-hidden="true" /> Chatbot answer preview
          </p>
          <ChatbotPreview
            compact
            settings={settings.data}
            messages={[
              { role: 'user', text: v.question || 'Your question will appear here' },
              {
                role: 'assistant',
                text: v.answer,
                sources: v.answer
                  ? [{ type: 'faq', title: `FAQ${v.categoryId ? ` · ${categoryName(v.categoryId)}` : ''}` }]
                  : [],
              },
            ]}
          />
          <p className="helper">
            Visual preview only — no AI is called. The live assistant may phrase answers differently.
          </p>
        </div>
      </div>
    </Drawer>
  );
}

export default function FAQsPage() {
  const { data: faqs = [], isPending, isError, error, refetch } = useApiQuery('faqs', getFaqs);
  const { categories, categoryName } = useLookups();
  const settings = useApiQuery('chatbotSettings', getChatbotSettings);
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const confirm = useConfirm();

  // ?edit=faq-001 (from global search / document links) opens the editor
  const editParam = params.get('edit');
  useEffect(() => {
    if (editParam && faqs.length) {
      const f = faqs.find((x) => x.id === editParam);
      if (f) setEditing(f);
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete('edit');
          return n;
        },
        { replace: true },
      );
    }
  }, [editParam, faqs, setParams]);

  const config = useMemo(
    () => ({
      searchFields: (f) => [f.question, f.answer, f.tags.join(' '), categoryName(f.categoryId)],
      filters: {
        status: (f, v) => f.status === v,
        category: (f, v) => f.categoryId === v,
        chatbot: (f, v) => (v === 'yes' ? f.includeInChatbot : !f.includeInChatbot),
      },
      sorters: {
        order: (f) => f.order,
        question: (f) => f.question,
        updatedAt: (f) => new Date(f.updatedAt).getTime(),
      },
      defaultSort: { key: 'order', dir: 'asc' },
    }),
    [categoryName],
  );
  const t = useTableState(faqs, config);

  const setStatus = useApiMutation(({ id, status, withdrawalReason }) => updateFaq(id, { status, withdrawalReason }), {
    invalidate: [['faqs']],
    success: (f) => `“${f.question}” is now ${f.status}`,
    error: 'Couldn’t change status',
  });
  const remove = useApiMutation((id) => deleteFaq(id), {
    invalidate: [['faqs']],
    success: 'FAQ deleted',
    error: 'Delete failed',
  });
  const bulk = useApiMutation(({ ids, status }) => bulkSetFaqStatus(ids, status), {
    invalidate: [['faqs']],
    success: (r, v) =>
      `${r.updated} FAQ(s) ${v.status === 'published' ? 'published' : 'unpublished'}${r.skipped.length ? ` · ${r.skipped.length} skipped (missing answer)` : ''}`,
    error: 'Bulk update failed',
    onSuccess: () => t.clearSelection(),
  });

  const menu = (f) =>
    [
      { label: 'Edit', icon: Pencil, onSelect: () => setEditing(f) },
      { label: 'Preview', icon: Eye, onSelect: () => setPreview(f) },
      f.status !== 'published' && {
        label: 'Publish',
        icon: Send,
        onSelect: () => setStatus.mutate({ id: f.id, status: 'published' }),
      },
      f.status === 'published' && {
        label: 'Unpublish',
        icon: Undo2,
        onSelect: () => setStatus.mutate({ id: f.id, status: 'draft' }),
      },
      f.status === 'published' && {
        label: 'Withdraw…',
        icon: Undo2,
        onSelect: async () => {
          const { confirmed, value } = await confirm({
            title: 'Withdraw this answer?',
            message: 'AI Bajan stops using it straight away. The reason is kept with the entry.',
            confirmLabel: 'Withdraw',
            tone: 'danger',
            input: { label: 'Reason for withdrawing', required: true },
          });
          if (confirmed) setStatus.mutate({ id: f.id, status: 'archived', withdrawalReason: value });
        },
      },
      {
        label: 'Delete',
        icon: Trash2,
        tone: 'danger',
        separatorBefore: true,
        onSelect: async () => {
          if (
            await confirm({
              title: 'Delete FAQ?',
              message: `“${f.question}” will be removed.`,
              confirmLabel: 'Delete',
              tone: 'danger',
            })
          )
            remove.mutate(f.id);
        },
      },
    ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="FAQs"
        description="Approved questions and answers for the website and the AI assistant."
        actions={
          <Button icon={Plus} onClick={() => setEditing({})}>
            Add FAQ
          </Button>
        }
      />
      <Card padded={false}>
        <FilterBar
          chips={[
            t.q && { key: 'q', label: `Search: “${t.q}”`, onRemove: () => t.setQ('') },
            t.filterValues.status && {
              key: 's',
              label: PUBLICATION_STATUSES[t.filterValues.status]?.label,
              onRemove: () => t.setFilter('status', ''),
            },
            t.filterValues.category && {
              key: 'c',
              label: categoryName(t.filterValues.category),
              onRemove: () => t.setFilter('category', ''),
            },
            t.filterValues.chatbot && {
              key: 'b',
              label: t.filterValues.chatbot === 'yes' ? 'In chatbot' : 'Not in chatbot',
              onRemove: () => t.setFilter('chatbot', ''),
            },
          ].filter(Boolean)}
          onReset={t.resetAll}
          actions={
            <SelectField
              label="Sort"
              hideLabel
              options={[
                { value: 'order:asc', label: 'Display order' },
                { value: 'updatedAt:desc', label: 'Recently updated' },
                { value: 'question:asc', label: 'Question A–Z' },
              ]}
              value={`${t.sortKey}:${t.sortDir}`}
              onValueChange={(x) => t.setSortExplicit(...x.split(':'))}
              className="w-44"
            />
          }
        >
          <SearchInput
            value={t.q}
            onChange={t.setQ}
            label="Search FAQs"
            placeholder="Question, answer or tag"
            className="lg:w-72"
          />
          <SelectField
            label="Status"
            placeholder="All"
            options={Object.entries(PUBLICATION_STATUSES).map(([k, s]) => ({ value: k, label: s.label }))}
            value={t.filterValues.status}
            onValueChange={(x) => t.setFilter('status', x)}
          />
          <SelectField
            label="Category"
            placeholder="All"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={t.filterValues.category}
            onValueChange={(x) => t.setFilter('category', x)}
          />
          <SelectField
            label="Chatbot"
            placeholder="All"
            options={[
              { value: 'yes', label: 'Included' },
              { value: 'no', label: 'Excluded' },
            ]}
            value={t.filterValues.chatbot}
            onValueChange={(x) => t.setFilter('chatbot', x)}
          />
        </FilterBar>
        {t.selectedIds.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-2 border-b border-line bg-accent-50/60 px-4 py-2.5"
            role="region"
            aria-label="Bulk actions"
          >
            <span className="mr-2 text-sm font-medium">{t.selectedIds.length} selected</span>
            <Button
              size="sm"
              variant="outline"
              icon={Send}
              loading={bulk.isPending}
              onClick={() => bulk.mutate({ ids: t.selectedIds, status: 'published' })}
            >
              Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={Undo2}
              onClick={() => bulk.mutate({ ids: t.selectedIds, status: 'draft' })}
            >
              Unpublish
            </Button>
            <button
              type="button"
              onClick={t.clearSelection}
              className="ml-auto text-xs font-medium text-muted hover:text-ink"
            >
              Clear selection
            </button>
          </div>
        )}
        <DataTable
          caption="FAQs"
          loading={isPending}
          error={isError ? error : null}
          onRetry={refetch}
          rows={t.pageItems}
          rowLabel={(f) => f.question}
          selection={t}
          sort={{ key: t.sortKey, dir: t.sortDir, onSort: t.setSort }}
          empty={{
            icon: HelpCircle,
            title: faqs.length ? 'No FAQs match your filters' : 'No FAQs yet',
            action: (
              <Button size="sm" icon={Plus} onClick={() => setEditing({})}>
                Add FAQ
              </Button>
            ),
          }}
          columns={[
            {
              key: 'order',
              header: '#',
              sortKey: 'order',
              width: 48,
              cell: (f) => <span className="tabular text-muted">{f.order}</span>,
            },
            {
              key: 'question',
              header: 'Question',
              sortKey: 'question',
              cell: (f) => (
                <button
                  type="button"
                  onClick={() => setEditing(f)}
                  className="block min-w-[14rem] max-w-lg text-left"
                >
                  <span className="block truncate font-medium text-ink hover:text-accent-600">
                    {f.question}
                  </span>
                  <span
                    className={`block truncate text-xs ${f.answer ? 'text-muted' : 'italic text-warning'}`}
                  >
                    {f.answer || 'No answer yet'}
                  </span>
                </button>
              ),
            },
            {
              key: 'category',
              header: 'Category',
              hideBelow: 'lg',
              cell: (f) => (
                <span className="whitespace-nowrap text-muted">
                  {f.categoryId ? categoryName(f.categoryId) : 'General'}
                </span>
              ),
            },
            {
              key: 'chatbot',
              header: 'Chatbot',
              hideBelow: 'md',
              cell: (f) => (
                <Badge tone={f.includeInChatbot ? 'accent' : 'muted'}>
                  {f.includeInChatbot ? 'Included' : 'Excluded'}
                </Badge>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (f) => <StatusBadge status={f.status} map={PUBLICATION_STATUSES} />,
            },
            {
              key: 'review',
              header: 'Review',
              hideBelow: 'lg',
              cell: (f) =>
                f.reviewOverdue ? (
                  <Badge tone="danger">Review overdue</Badge>
                ) : f.reviewDue ? (
                  <span className="whitespace-nowrap text-muted">by {formatDate(f.reviewDue)}</span>
                ) : (
                  <span className="text-muted">—</span>
                ),
            },
            {
              key: 'updated',
              header: 'Updated',
              sortKey: 'updatedAt',
              hideBelow: 'xl',
              cell: (f) => <span className="whitespace-nowrap text-muted">{formatDate(f.updatedAt)}</span>,
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (f) => (
                <DropdownMenu
                  label={`Actions for ${f.question}`}
                  items={menu(f)}
                  trigger={
                    <IconButton label={`Actions for FAQ ${f.order}`} icon={MoreHorizontal} tooltip={false} />
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
          label="FAQs"
        />
      </Card>

      <FaqEditor
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        faq={editing?.id ? editing : null}
        nextOrder={faqs.length + 1}
      />
      <Modal
        open={Boolean(preview)}
        onOpenChange={(o) => !o && setPreview(null)}
        title="FAQ preview"
        description="How this answer may appear in the chat widget (visual only)."
        size="sm"
      >
        {preview && (
          <ChatbotPreview
            compact
            settings={settings.data}
            messages={[
              { role: 'user', text: preview.question },
              { role: 'assistant', text: preview.answer, sources: [{ type: 'faq', title: 'FAQ' }] },
            ]}
          />
        )}
      </Modal>
    </>
  );
}
