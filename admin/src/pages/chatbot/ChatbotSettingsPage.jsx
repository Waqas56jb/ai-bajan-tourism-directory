import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RotateCcw, Save, ShieldAlert } from 'lucide-react';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { getChatbotSettings, saveChatbotSettings, resetChatbotSettings } from '@/services/chatbotService';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { SectionHeader } from '@/components/common/SectionHeader';
import { Button } from '@/components/common/Button';
import { Tabs } from '@/components/common/Tabs';
import { TextField, TextAreaField, SelectField } from '@/components/common/Fields';
import { Toggle } from '@/components/common/Toggle';
import { TagInput } from '@/components/common/TagInput';
import { Modal } from '@/components/common/Modal';
import { Badge } from '@/components/common/Badge';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { DemoNotice, ErrorState, PageLoading } from '@/components/common/States';
import { ChatbotPreview } from '@/components/chatbot/ChatbotPreview';
import { LANGUAGES } from '@/utils/constants';

const schema = z.object({
  enabled: z.boolean(),
  displayName: z.string().trim().min(2, 'Display name is required.').max(40),
  welcomeMessage: z.string().trim().min(10, 'Add a welcome message.').max(300),
  description: z.string().trim().max(300),
  defaultLanguage: z.string(),
  supportedLanguages: z.array(z.string()).min(1, 'Choose at least one language.'),
  suggestedQuestions: z.array(z.string()).max(6, 'Up to 6 suggested questions.'),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #0d948e.'),
  avatar: z.enum(['compass', 'sparkles', 'chat']),
  widgetTitle: z.string().trim().min(2, 'Widget title is required.').max(40),
  widgetSubtitle: z.string().trim().max(60),
  welcomeScreen: z.string().trim().max(300),
  answerStyle: z.enum(['concise', 'detailed', 'step_by_step']),
  responseLength: z.enum(['short', 'medium', 'long']),
  tone: z.enum(['friendly', 'professional', 'warm_local']),
  includeSources: z.boolean(),
  approvedOnly: z.boolean(),
  fallbackMessage: z.string().trim().min(10, 'A fallback message is required.').max(300),
  askClarifying: z.boolean(),
  showEscalation: z.boolean(),
  escalationText: z.string().trim().max(300),
  includeListings: z.boolean(),
  includeFaqs: z.boolean(),
  includeDocuments: z.boolean(),
  excludeDrafts: z.boolean(),
  excludeRejected: z.boolean(),
  excludePrivateNotes: z.boolean(),
  maxResponseChars: z.coerce
    .number()
    .int()
    .min(200, 'At least 200 characters.')
    .max(4000, 'At most 4,000 characters.'),
  rateLimitDescription: z.string().trim().max(200),
  sensitiveDataNotice: z.string().trim().max(300),
  outOfScopeMessage: z.string().trim().min(10, 'Required.').max(300),
  errorFallbackMessage: z.string().trim().min(10, 'Required.').max(300),
  sourceAttribution: z.enum(['inline', 'footer', 'none']),
});

function ToggleField({ control, name, label, description, disabled }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Toggle
          label={label}
          description={description}
          checked={Boolean(field.value)}
          onChange={field.onChange}
          disabled={disabled}
        />
      )}
    />
  );
}

function SettingsForm({ initial }) {
  const confirm = useConfirm();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(schema), defaultValues: initial });
  const v = useWatch({ control });
  const blocker = useUnsavedChanges(isDirty);

  const save = useApiMutation(saveChatbotSettings, {
    invalidate: [['chatbotSettings']],
    success: 'Chatbot settings saved (local demo configuration)',
    error: 'Couldn’t save settings',
    onSuccess: (data) => reset(data),
  });
  const resetDefaults = useApiMutation(resetChatbotSettings, {
    invalidate: [['chatbotSettings']],
    success: 'Settings reset to demo defaults',
    error: 'Reset failed',
    onSuccess: (data) => reset(data),
  });

  const errorCount = Object.keys(errors).length;

  const tabs = [
    {
      value: 'general',
      label: 'General',
      content: (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <ToggleField
              control={control}
              name="enabled"
              label="Chatbot enabled"
              description="Show the assistant on the public website (demo setting — not applied to any live site)."
            />
          </div>
          <TextField
            label="Display name"
            required
            error={errors.displayName?.message}
            {...register('displayName')}
          />
          <SelectField
            label="Default language"
            options={v.supportedLanguages?.length ? v.supportedLanguages : LANGUAGES}
            {...register('defaultLanguage')}
          />
          <TextAreaField
            label="Welcome message"
            required
            rows={3}
            maxLength={300}
            value={v.welcomeMessage}
            error={errors.welcomeMessage?.message}
            className="md:col-span-2"
            {...register('welcomeMessage')}
          />
          <TextAreaField
            label="Assistant description"
            rows={2}
            maxLength={300}
            value={v.description}
            className="md:col-span-2"
            {...register('description')}
          />
          <Controller
            control={control}
            name="supportedLanguages"
            render={({ field }) => (
              <div>
                <TagInput
                  label="Supported languages"
                  value={field.value}
                  onChange={field.onChange}
                  suggestions={LANGUAGES}
                />
                {errors.supportedLanguages && (
                  <p className="error-text">{errors.supportedLanguages.message}</p>
                )}
              </div>
            )}
          />
          <Controller
            control={control}
            name="suggestedQuestions"
            render={({ field }) => (
              <div>
                <TagInput
                  label="Suggested questions"
                  value={field.value}
                  onChange={field.onChange}
                  max={6}
                  helper="Shown as quick-start chips. Up to 6."
                />
                {errors.suggestedQuestions && (
                  <p className="error-text">{errors.suggestedQuestions.message}</p>
                )}
              </div>
            )}
          />
        </div>
      ),
    },
    {
      value: 'appearance',
      label: 'Appearance',
      content: (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Controller
            control={control}
            name="brandColor"
            render={({ field }) => (
              <div>
                <label htmlFor="brand-color" className="label">
                  Brand colour
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label="Pick brand colour"
                    className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1"
                    value={/^#[0-9a-f]{6}$/i.test(field.value ?? '') ? field.value : '#0d948e'}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                  <input
                    id="brand-color"
                    className="field font-mono"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    aria-invalid={errors.brandColor ? 'true' : 'false'}
                  />
                </div>
                {errors.brandColor && <p className="error-text">{errors.brandColor.message}</p>}
              </div>
            )}
          />
          <SelectField
            label="Assistant avatar"
            options={[
              { value: 'compass', label: 'Compass' },
              { value: 'sparkles', label: 'Sparkles' },
              { value: 'chat', label: 'Chat bubble' },
            ]}
            {...register('avatar')}
          />
          <TextField
            label="Widget title"
            required
            error={errors.widgetTitle?.message}
            {...register('widgetTitle')}
          />
          <TextField label="Widget subtitle" {...register('widgetSubtitle')} />
          <TextAreaField
            label="Welcome screen content"
            rows={3}
            maxLength={300}
            value={v.welcomeScreen}
            className="md:col-span-2"
            {...register('welcomeScreen')}
          />
        </div>
      ),
    },
    {
      value: 'behavior',
      label: 'Answer behaviour',
      content: (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField
            label="Answer style"
            options={[
              { value: 'concise', label: 'Concise' },
              { value: 'detailed', label: 'Detailed' },
              { value: 'step_by_step', label: 'Step by step' },
            ]}
            {...register('answerStyle')}
          />
          <SelectField
            label="Response length"
            options={[
              { value: 'short', label: 'Short' },
              { value: 'medium', label: 'Medium' },
              { value: 'long', label: 'Long' },
            ]}
            {...register('responseLength')}
          />
          <SelectField
            label="Tone"
            options={[
              { value: 'friendly', label: 'Friendly' },
              { value: 'professional', label: 'Professional' },
              { value: 'warm_local', label: 'Warm & local' },
            ]}
            {...register('tone')}
          />
          <div />
          <ToggleField
            control={control}
            name="includeSources"
            label="Include source references"
            description="Show which listing or guide an answer came from."
          />
          <ToggleField
            control={control}
            name="approvedOnly"
            label="Use only approved knowledge"
            description="Never answer from unapproved or general web knowledge."
          />
          <ToggleField
            control={control}
            name="askClarifying"
            label="Ask clarifying questions"
            description="When a question is ambiguous (e.g. no area given)."
          />
          <ToggleField
            control={control}
            name="showEscalation"
            label="Show contact / escalation instructions"
          />
          <TextAreaField
            label="Fallback message"
            required
            rows={2}
            maxLength={300}
            value={v.fallbackMessage}
            error={errors.fallbackMessage?.message}
            className="md:col-span-2"
            {...register('fallbackMessage')}
          />
          {v.showEscalation && (
            <TextAreaField
              label="Escalation instructions"
              rows={2}
              maxLength={300}
              value={v.escalationText}
              className="md:col-span-2"
              {...register('escalationText')}
            />
          )}
        </div>
      ),
    },
    {
      value: 'knowledge',
      label: 'Knowledge',
      content: (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <ToggleField control={control} name="includeListings" label="Include published listings" />
          <ToggleField control={control} name="includeFaqs" label="Include approved FAQs" />
          <ToggleField control={control} name="includeDocuments" label="Include approved tourism documents" />
          <ToggleField control={control} name="excludeDrafts" label="Exclude drafts" />
          <ToggleField control={control} name="excludeRejected" label="Exclude rejected content" />
          <Toggle
            label="Exclude private administrator notes"
            description="Always on — internal notes are never available to the chatbot."
            checked
            disabled
            onChange={() => {}}
          />
        </div>
      ),
    },
    {
      value: 'safety',
      label: 'Safety & reliability',
      content: (
        <div className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <p className="text-ink">
              These are <strong>visual mock controls</strong>. They are not active security controls — rate
              limiting, prompt-injection defence and sensitive-data handling must be implemented and enforced
              by the backend.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="Maximum response length (characters)"
              type="number"
              min={200}
              max={4000}
              error={errors.maxResponseChars?.message}
              {...register('maxResponseChars')}
            />
            <SelectField
              label="Source attribution"
              options={[
                { value: 'inline', label: 'Inline after the answer' },
                { value: 'footer', label: 'Collapsed footer' },
                { value: 'none', label: 'Don’t show sources' },
              ]}
              {...register('sourceAttribution')}
            />
            <TextAreaField
              label="Rate-limit policy (description)"
              rows={2}
              className="md:col-span-2"
              {...register('rateLimitDescription')}
            />
            <TextAreaField
              label="Sensitive-data notice"
              rows={2}
              className="md:col-span-2"
              {...register('sensitiveDataNotice')}
            />
            <TextAreaField
              label="Out-of-scope message"
              required
              rows={2}
              error={errors.outOfScopeMessage?.message}
              {...register('outOfScopeMessage')}
            />
            <TextAreaField
              label="Error fallback message"
              required
              rows={2}
              error={errors.errorFallbackMessage?.message}
              {...register('errorFallbackMessage')}
            />
          </div>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-3">
              <dt className="text-xs text-muted">Prompt-injection defence status</dt>
              <dd className="mt-1">
                <Badge tone="muted" dot>
                  Not connected — backend required
                </Badge>
              </dd>
            </div>
            <div className="rounded-xl border border-line p-3">
              <dt className="text-xs text-muted">Rate limiting status</dt>
              <dd className="mt-1">
                <Badge tone="muted" dot>
                  Not connected — backend required
                </Badge>
              </dd>
            </div>
          </dl>
        </div>
      ),
    },
  ];

  return (
    <form
      noValidate
      onSubmit={handleSubmit((data) => save.mutate(data))}
      className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
    >
      <Card className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <SectionHeader title="Configuration" className="!mb-0" />
          <div className="flex items-center gap-2">
            {isDirty && (
              <Badge tone="warning" dot>
                Unsaved changes
              </Badge>
            )}
            {errorCount > 0 && <Badge tone="danger">{errorCount} field(s) need attention</Badge>}
          </div>
        </div>
        <Tabs tabs={tabs} listLabel="Chatbot settings sections" />
        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <Button
            variant="ghost"
            icon={RotateCcw}
            loading={resetDefaults.isPending}
            onClick={async () => {
              if (
                await confirm({
                  title: 'Reset to demo defaults?',
                  message: 'All chatbot settings will be restored to the original demo values.',
                  confirmLabel: 'Reset settings',
                  tone: 'danger',
                })
              )
                resetDefaults.mutate();
            }}
          >
            Reset to defaults
          </Button>
          <Button variant="outline" disabled={!isDirty} onClick={() => reset(initial)}>
            Discard changes
          </Button>
          <Button type="submit" icon={Save} loading={save.isPending} disabled={!isDirty}>
            Save changes
          </Button>
        </div>
      </Card>
      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <p className="label">Widget preview</p>
        <ChatbotPreview
          settings={v}
          messages={[
            { role: 'assistant', text: v.welcomeMessage },
            { role: 'user', text: v.suggestedQuestions?.[0] ?? 'Find restaurants near Holetown.' },
            {
              role: 'assistant',
              text: 'Here’s a sample answer showing how listings appear in the widget.',
              sources:
                v.includeSources && v.sourceAttribution !== 'none'
                  ? [{ type: 'listing', title: 'Saltwind Beach Kitchen' }]
                  : [],
            },
          ]}
        />
        {!v.enabled && (
          <p className="text-sm font-medium text-warning">The chatbot is disabled in this configuration.</p>
        )}
        <DemoNotice>
          Saved to this browser only. The live assistant will read settings from the backend.
        </DemoNotice>
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
        <p className="text-sm text-muted">Your chatbot settings changes haven’t been saved.</p>
      </Modal>
    </form>
  );
}

export default function ChatbotSettingsPage() {
  const { data, isPending, isError, error, refetch } = useApiQuery('chatbotSettings', getChatbotSettings);
  return (
    <>
      <PageHeader
        title="Chatbot settings"
        description="Configure how the AI Bajan assistant looks and behaves. Stored locally as demo configuration."
      />
      {isError ? (
        <Card>
          <ErrorState message={error?.message} onRetry={refetch} />
        </Card>
      ) : isPending ? (
        <PageLoading />
      ) : (
        <SettingsForm initial={data} />
      )}
    </>
  );
}
