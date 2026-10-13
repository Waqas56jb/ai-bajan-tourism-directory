import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bold, Heading2, List, Save, Send } from 'lucide-react';
import { useApiMutation, useApiQuery } from '@/hooks/useApi';
import { useLookups } from '@/hooks/useLookups';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { usePageTitle } from '@/context/PageMetaContext';
import {
  createKnowledgeDocument,
  getKnowledgeDocumentById,
  updateKnowledgeDocument,
} from '@/services/knowledgeService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { SectionHeader } from '@/components/common/SectionHeader';
import { Button } from '@/components/common/Button';
import { TextField, TextAreaField, SelectField } from '@/components/common/Fields';
import { Toggle } from '@/components/common/Toggle';
import { TagInput } from '@/components/common/TagInput';
import { Tabs } from '@/components/common/Tabs';
import { Modal } from '@/components/common/Modal';
import { ContentPreview } from '@/components/common/ContentPreview';
import { DemoNotice, ErrorState, PageLoading } from '@/components/common/States';
import { PUBLICATION_STATUSES, SOURCE_TYPES } from '@/utils/constants';
import NotFoundPage from '@/pages/errors/NotFoundPage';

const schema = z
  .object({
    title: z.string().trim().min(3, 'Title is required.').max(140),
    summary: z.string().trim().max(300, 'Keep the summary under 300 characters.'),
    content: z.string().trim().min(20, 'Content is required (at least 20 characters).').max(20000),
    sourceType: z.string().min(1),
    categoryId: z.string(),
    locationId: z.string(),
    relatedListingId: z.string(),
    tags: z.array(z.string()),
    status: z.enum(['draft', 'review', 'published', 'archived']),
    includeInChatbot: z.boolean(),
    visibility: z.enum(['public', 'internal']),
    requiresApproval: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.status === 'published' && !v.summary.trim())
      ctx.addIssue({ path: ['summary'], code: 'custom', message: 'Add a summary before publishing.' });
    if (v.includeInChatbot && v.visibility === 'internal')
      ctx.addIssue({
        path: ['includeInChatbot'],
        code: 'custom',
        message: 'Internal-only documents can’t be used by the chatbot.',
      });
  });

const toForm = (d) => ({
  title: d?.title ?? '',
  summary: d?.summary ?? '',
  content: d?.content ?? '',
  sourceType: d?.sourceType ?? 'article',
  categoryId: d?.categoryId ?? '',
  locationId: d?.locationId ?? '',
  relatedListingId: d?.relatedListingId ?? '',
  tags: d?.tags ?? [],
  status: d?.status ?? 'draft',
  includeInChatbot: d?.includeInChatbot ?? true,
  visibility: d?.visibility ?? 'public',
  requiresApproval: d?.requiresApproval ?? false,
});

function DocumentForm({ doc, onSaved }) {
  const editing = Boolean(doc);
  const { categories, locations, listings } = useLookups();
  const contentRef = useRef(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(schema), defaultValues: toForm(doc) });
  const values = useWatch({ control });
  const blocker = useUnsavedChanges(isDirty && !saved);

  const save = useApiMutation(
    (v) => (editing ? updateKnowledgeDocument(doc.id, v) : createKnowledgeDocument(v)),
    {
      invalidate: [['documents'], ['document'], ['syncJobs']],
      success: (d) =>
        `${editing ? 'Saved' : 'Created'} “${d.title}”${d.indexingStatus === 'pending' ? ' — queued for indexing (simulated)' : ''}`,
      error: 'Couldn’t save the document',
    },
  );

  const submit = (status) =>
    handleSubmit(async (v) => {
      const payload = {
        ...v,
        status,
        categoryId: v.categoryId || null,
        locationId: v.locationId || null,
        relatedListingId: v.relatedListingId || null,
      };
      setSaved(true);
      try {
        const d = await save.mutateAsync(payload);
        onSaved(d);
      } catch {
        setSaved(false);
      }
    });

  const wrap = (before, after = '', linePrefix = false) => {
    const el = contentRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const text = getValues('content');
    const selected = text.slice(s, e) || (linePrefix ? 'Item' : 'text');
    const insert = linePrefix
      ? `${s > 0 && text[s - 1] !== '\n' ? '\n' : ''}${before}${selected}`
      : `${before}${selected}${after}`;
    setValue('content', text.slice(0, s) + insert + text.slice(e), {
      shouldDirty: true,
      shouldValidate: true,
    });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + insert.length, s + insert.length);
    });
  };

  const { ref: contentRegRef, ...contentReg } = register('content');
  const words = (values.content ?? '').trim().split(/\s+/).filter(Boolean).length;

  return (
    <form
      noValidate
      onSubmit={(e) => e.preventDefault()}
      className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
    >
      <div className="min-w-0 space-y-6">
        <Card>
          <SectionHeader title="Document" />
          <div className="grid gap-4">
            <TextField
              label="Title"
              required
              maxLength={140}
              value={values.title}
              error={errors.title?.message}
              {...register('title')}
            />
            <TextAreaField
              label="Summary"
              rows={2}
              maxLength={300}
              value={values.summary}
              error={errors.summary?.message}
              helper="Shown in admin lists and used as a retrieval hint."
              {...register('summary')}
            />
          </div>
        </Card>
        <Card>
          <SectionHeader
            title="Content"
            description="Supports ## headings, - bullet lists and **bold**. Raw HTML is shown as text, never executed."
          />
          <Tabs
            listLabel="Editor mode"
            tabs={[
              {
                value: 'write',
                label: 'Write',
                content: (
                  <div>
                    <div className="mb-2 flex gap-1" role="toolbar" aria-label="Formatting">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Heading2}
                        onClick={() => wrap('## ', '', true)}
                        aria-label="Insert heading"
                      >
                        Heading
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={List}
                        onClick={() => wrap('- ', '', true)}
                        aria-label="Insert bullet"
                      >
                        Bullet
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Bold}
                        onClick={() => wrap('**', '**')}
                        aria-label="Bold selection"
                      >
                        Bold
                      </Button>
                    </div>
                    <TextAreaField
                      label="Content"
                      hideLabel
                      required
                      rows={16}
                      className="[&_textarea]:font-mono [&_textarea]:text-[0.82rem]"
                      error={errors.content?.message}
                      ref={(el) => {
                        contentRegRef(el);
                        contentRef.current = el;
                      }}
                      {...contentReg}
                    />
                    <p className="helper">
                      {words} words · {(values.content ?? '').length.toLocaleString()} / 20,000 characters
                    </p>
                  </div>
                ),
              },
              {
                value: 'preview',
                label: 'Preview',
                content: (
                  <div className="min-h-[18rem] rounded-xl border border-line p-4">
                    <ContentPreview content={values.content} />
                  </div>
                ),
              },
            ]}
          />
        </Card>
        <Card>
          <SectionHeader title="Classification" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField
              label="Source type"
              required
              options={Object.entries(SOURCE_TYPES).map(([v, l]) => ({ value: v, label: l }))}
              {...register('sourceType')}
            />
            <SelectField
              label="Topic category"
              placeholder="General"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              {...register('categoryId')}
            />
            <SelectField
              label="Location"
              placeholder="Island-wide"
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              {...register('locationId')}
            />
            <SelectField
              label="Related listing"
              placeholder="None"
              options={listings.map((l) => ({ value: l.id, label: l.name }))}
              {...register('relatedListingId')}
            />
            <div className="md:col-span-2">
              <Controller
                control={control}
                name="tags"
                render={({ field }) => (
                  <TagInput label="Tags" value={field.value} onChange={field.onChange} />
                )}
              />
            </div>
          </div>
        </Card>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <Card>
          <SectionHeader title="Publishing & visibility" />
          <div className="space-y-4">
            <SelectField
              label="Publication status"
              options={Object.entries(PUBLICATION_STATUSES).map(([v, s]) => ({ value: v, label: s.label }))}
              {...register('status')}
            />
            <SelectField
              label="Visibility"
              options={[
                { value: 'public', label: 'Public content' },
                { value: 'internal', label: 'Internal reference only' },
              ]}
              {...register('visibility')}
            />
            <Controller
              control={control}
              name="includeInChatbot"
              render={({ field }) => (
                <Toggle
                  label="Include in chatbot"
                  description="Only published, public documents are indexed."
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.includeInChatbot && <p className="error-text">{errors.includeInChatbot.message}</p>}
            <Controller
              control={control}
              name="requiresApproval"
              render={({ field }) => (
                <Toggle label="Requires editorial approval" checked={field.value} onChange={field.onChange} />
              )}
            />
          </div>
          <div className="mt-5 grid gap-2">
            <Button
              variant="outline"
              icon={Save}
              loading={save.isPending && values.status !== 'published'}
              disabled={save.isPending}
              onClick={submit(values.status === 'published' ? 'draft' : (values.status ?? 'draft'))}
            >
              {values.status === 'published' ? 'Save as draft' : 'Save'}
            </Button>
            <Button
              icon={Send}
              disabled={save.isPending}
              loading={save.isPending && values.status === 'published'}
              onClick={submit('published')}
            >
              Save and publish
            </Button>
          </div>
          {isDirty && !saved && (
            <p className="mt-3 text-xs font-medium text-warning" role="status">
              Unsaved changes
            </p>
          )}
        </Card>
        <DemoNotice>Publishing a chatbot-visible document queues a simulated indexing job.</DemoNotice>
      </aside>

      <Modal
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => !o && blocker.reset?.()}
        title="Leave without saving?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => blocker.reset?.()}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={() => blocker.proceed?.()}>
              Discard changes
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Your changes to this document haven’t been saved.</p>
      </Modal>
    </form>
  );
}

export default function KnowledgeDocumentFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const lookups = useLookups();
  const query = useApiQuery(['document', id], () => getKnowledgeDocumentById(id), { enabled: Boolean(id) });
  usePageTitle(id ? query.data?.title : null);
  const key = useMemo(() => (id ? query.data?.id : 'new'), [id, query.data]);

  if (id && query.isError && query.error?.status === 404)
    return <NotFoundPage title="Document not found" backTo="/knowledge" backLabel="Back to knowledge base" />;

  return (
    <>
      <PageHeader
        title={id ? 'Edit document' : 'New knowledge document'}
        setTitle={!id}
        description="Write or update content the AI assistant may use once approved."
      />
      {id && query.isError ? (
        <Card>
          <ErrorState message={query.error?.message} onRetry={query.refetch} />
        </Card>
      ) : (id && query.isPending) || lookups.isLoading ? (
        <PageLoading />
      ) : (
        <DocumentForm
          key={key}
          doc={id ? query.data : null}
          onSaved={(d) => navigate(`/knowledge/${d.id}`)}
        />
      )}
    </>
  );
}
