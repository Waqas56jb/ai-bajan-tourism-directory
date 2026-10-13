import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { AlertTriangle, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useApiQuery } from '@/hooks/useApi';
import {
  getGeneralSettings,
  saveGeneralSettings,
  resetGeneralSettings,
  resetDemoData,
  getSimulateFailures,
  setSimulateFailures,
} from '@/services/settingsService';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettingsNav, useSettingsForm } from '@/components/forms/SettingsShell';
import { Card } from '@/components/common/Card';
import { SectionHeader } from '@/components/common/SectionHeader';
import { TextField, TextAreaField, SelectField } from '@/components/common/Fields';
import { Toggle } from '@/components/common/Toggle';
import { Button } from '@/components/common/Button';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { DemoNotice, ErrorState, PageLoading } from '@/components/common/States';
import { isValidUrl } from '@/utils/validation';
import { STORAGE_PREFIX } from '@/utils/storage';

const schema = z.object({
  platformName: z.string().trim().min(2, 'Platform name is required.').max(60),
  platformDescription: z.string().trim().max(300),
  supportEmail: z.string().trim().email('Enter a valid email address.'),
  publicUrl: z.string().trim().refine(isValidUrl, 'Enter a full URL starting with https://'),
  locale: z.string(),
  timezone: z.string(),
  country: z.string().trim().min(2),
  approvalPolicy: z.string().trim().max(500),
  defaultListingStatus: z.enum(['draft', 'pending', 'published']),
  requireApproval: z.boolean(),
  defaultChatbotVisibility: z.boolean(),
  defaultSeoVisibility: z.boolean(),
  defaultFeatured: z.boolean(),
  maintenanceMode: z.boolean(),
});

function DemoTools() {
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [failures, setFailures] = useState(() => getSimulateFailures());
  return (
    <Card>
      <SectionHeader title="Demo tools" description="Development helpers for this frontend-only build." />
      <div className="space-y-5">
        <Toggle
          label="Simulate failed saves"
          description="Every write operation fails so you can test error states. Your input is preserved."
          checked={failures}
          onChange={(v) => {
            setSimulateFailures(v);
            setFailures(v);
            toast[v ? 'warning' : 'success'](
              v ? 'Simulated failures enabled' : 'Simulated failures disabled',
            );
          }}
        />
        <div className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Database className="h-4 w-4 text-danger" aria-hidden="true" /> Reset demo data
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Restores every listing, category, document, setting and log to the original sample data. Only
              keys starting with <code>{STORAGE_PREFIX}</code> are cleared.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={async () => {
              if (
                await confirm({
                  title: 'Reset all demo data?',
                  message: 'All changes you made in this browser will be lost. You will stay signed in.',
                  confirmLabel: 'Reset demo data',
                  tone: 'danger',
                })
              ) {
                resetDemoData();
                setFailures(false);
                await qc.resetQueries();
                toast.success('Demo data restored');
              }
            }}
          >
            Reset demo data
          </Button>
        </div>
      </div>
    </Card>
  );
}

function GeneralForm({ values }) {
  const confirm = useConfirm();
  const { form, onSubmit, actions, leaveGuard } = useSettingsForm({
    schema,
    values,
    save: saveGeneralSettings,
    reset: resetGeneralSettings,
    invalidate: [['generalSettings']],
  });
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;
  const maintenance = watch('maintenanceMode');

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-6">
      <Card>
        <SectionHeader title="Platform" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Platform name"
            required
            error={errors.platformName?.message}
            {...register('platformName')}
          />
          <TextField
            label="Support email"
            type="email"
            required
            error={errors.supportEmail?.message}
            {...register('supportEmail')}
          />
          <TextAreaField
            label="Platform description"
            rows={2}
            className="md:col-span-2"
            error={errors.platformDescription?.message}
            {...register('platformDescription')}
          />
          <TextField
            label="Public website URL"
            type="url"
            required
            error={errors.publicUrl?.message}
            {...register('publicUrl')}
          />
          <TextField label="Default country" {...register('country')} />
          <SelectField
            label="Default locale"
            options={[
              { value: 'en-GB', label: 'English (UK)' },
              { value: 'en-US', label: 'English (US)' },
              { value: 'es', label: 'Spanish' },
              { value: 'fr', label: 'French' },
            ]}
            {...register('locale')}
          />
          <SelectField
            label="Default timezone"
            options={['America/Barbados', 'America/New_York', 'Europe/London', 'UTC']}
            {...register('timezone')}
          />
          <TextAreaField
            label="Listing approval policy"
            rows={2}
            className="md:col-span-2"
            helper="Shown to business owners when they submit listings."
            {...register('approvalPolicy')}
          />
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Listing defaults"
          description="Applied when an administrator creates a new listing."
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <SelectField
            label="Default listing status"
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'pending', label: 'Pending review' },
              { value: 'published', label: 'Published' },
            ]}
            {...register('defaultListingStatus')}
          />
          <div />
          {[
            [
              'requireApproval',
              'Require approval before publishing',
              'Owner submissions go to the review queue.',
            ],
            ['defaultChatbotVisibility', 'Include new listings in chatbot knowledge', null],
            ['defaultSeoVisibility', 'Visible in site search by default', null],
            [
              'defaultFeatured',
              'Mark new listings as featured',
              'Usually off — featuring is a paid placement.',
            ],
          ].map(([name, label, description]) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field }) => (
                <Toggle
                  label={label}
                  description={description}
                  checked={Boolean(field.value)}
                  onChange={field.onChange}
                />
              )}
            />
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeader title="Maintenance mode" />
        <Controller
          control={control}
          name="maintenanceMode"
          render={({ field }) => (
            <Toggle
              label="Maintenance mode (demo)"
              description="Would show a maintenance page to visitors. In this demo it only changes a local setting — the live site is not affected."
              checked={Boolean(field.value)}
              onChange={async (v) => {
                if (
                  v &&
                  !(await confirm({
                    title: 'Turn on maintenance mode?',
                    message:
                      'In production this would hide the public website from visitors. In this demo nothing is taken offline.',
                    confirmLabel: 'Turn on',
                    tone: 'danger',
                  }))
                )
                  return;
                field.onChange(v);
              }}
            />
          )}
        />
        {maintenance && (
          <p
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-xs font-medium text-warning"
            role="status"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Maintenance mode is on in this demo
            configuration.
          </p>
        )}
      </Card>

      <div className="sticky bottom-0 z-10 -mx-3 border-t border-line bg-canvas/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
        {actions}
      </div>
      {leaveGuard}
    </form>
  );
}

export default function GeneralSettingsPage() {
  const { data, isPending, isError, error, refetch } = useApiQuery('generalSettings', getGeneralSettings);
  return (
    <>
      <PageHeader
        title="Settings"
        description="Platform configuration. All values are local demo configuration for this browser."
      />
      <SettingsNav />
      <DemoNotice className="mb-6" title="Local demo configuration">
        Settings are saved in this browser only and are not applied to the public website.
      </DemoNotice>
      {isError ? (
        <Card>
          <ErrorState message={error?.message} onRetry={refetch} />
        </Card>
      ) : isPending ? (
        <PageLoading />
      ) : (
        <div className="space-y-6">
          <GeneralForm values={data} />
          <DemoTools />
        </div>
      )}
    </>
  );
}
