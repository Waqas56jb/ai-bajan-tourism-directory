import { Controller } from 'react-hook-form';
import { z } from 'zod';
import { useApiQuery } from '@/hooks/useApi';
import { getGeneralSettings, saveGeneralSettings, resetGeneralSettings } from '@/services/settingsService';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettingsNav, useSettingsForm } from '@/components/forms/SettingsShell';
import { Card } from '@/components/common/Card';
import { SectionHeader } from '@/components/common/SectionHeader';
import { Toggle } from '@/components/common/Toggle';
import { DemoNotice, ErrorState, PageLoading } from '@/components/common/States';

const EVENTS = [
  ['notifyNewSubmission', 'New listing submission', 'A business owner submits a new or edited listing.'],
  ['notifyApproved', 'Listing approved', 'A moderator approves a submission.'],
  ['notifyRejected', 'Listing rejected', 'A submission is rejected.'],
  ['notifySyncFailure', 'Knowledge sync failure', 'An indexing job fails after retries.'],
  ['notifyNegativeFeedback', 'Negative chatbot feedback', 'A visitor marks an answer as unhelpful.'],
  ['notifyIncident', 'System incident', 'A monitored service reports a problem.'],
];

const schema = z.object(Object.fromEntries(EVENTS.map(([k]) => [k, z.boolean()])));

function NotificationsForm({ values }) {
  const { form, onSubmit, actions, leaveGuard } = useSettingsForm({
    schema,
    values,
    save: saveGeneralSettings,
    reset: resetGeneralSettings,
    invalidate: [['generalSettings']],
    successMessage: 'Notification settings saved (demo)',
  });
  return (
    <form noValidate onSubmit={onSubmit}>
      <Card>
        <SectionHeader
          title="Platform notifications"
          description="Which events should alert administrators."
        />
        <div className="divide-y divide-line">
          {EVENTS.map(([name, label, description]) => (
            <div key={name} className="py-4 first:pt-0">
              <Controller
                control={form.control}
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
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-line pt-4">{actions}</div>
      </Card>
      {leaveGuard}
    </form>
  );
}

export default function NotificationSettingsPage() {
  const { data, isPending, isError, error, refetch } = useApiQuery('generalSettings', getGeneralSettings);
  return (
    <>
      <PageHeader title="Settings" description="Notification preferences for platform events." />
      <SettingsNav />
      <DemoNotice className="mb-6">
        No emails or push notifications are sent yet. These preferences will drive backend notifications once
        connected.
      </DemoNotice>
      {isError ? (
        <Card>
          <ErrorState message={error?.message} onRetry={refetch} />
        </Card>
      ) : isPending ? (
        <PageLoading />
      ) : (
        <NotificationsForm values={data} />
      )}
    </>
  );
}
