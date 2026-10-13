import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, Laptop, LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useApiQuery } from '@/hooks/useApi';
import { getAccountSettings, saveAccountSettings } from '@/services/settingsService';
import { usePreferences } from '@/context/PreferencesContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettingsNav, useSettingsForm } from '@/components/forms/SettingsShell';
import { Card } from '@/components/common/Card';
import { SectionHeader } from '@/components/common/SectionHeader';
import { TextField, SelectField } from '@/components/common/Fields';
import { Toggle } from '@/components/common/Toggle';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/common/Badge';
import { DemoNotice, ErrorState, PageLoading } from '@/components/common/States';
import { formatRelative } from '@/utils/formatDate';

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Name is required.').max(80),
  email: z.string().trim().email('Enter a valid email address.'),
  jobTitle: z.string().trim().max(60),
  language: z.string(),
  timezone: z.string(),
  dateFormat: z.string(),
  theme: z.enum(['light', 'dark', 'system']),
  emailDigest: z.enum(['off', 'daily', 'weekly']),
  notifyMentions: z.boolean(),
  notifyAssignments: z.boolean(),
  avatarColor: z.string(),
});

const passwordSchema = z
  .object({
    current: z.string().min(1, 'Enter your current password.'),
    next: z
      .string()
      .min(12, 'Use at least 12 characters.')
      .regex(/[A-Z]/, 'Include an uppercase letter.')
      .regex(/[0-9]/, 'Include a number.'),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ['confirm'], message: 'Passwords don’t match.' });

const SESSIONS = [
  {
    id: 's1',
    device: 'This browser',
    icon: Laptop,
    place: 'Bridgetown (approx.)',
    at: new Date().toISOString(),
    current: true,
  },
  {
    id: 's2',
    device: 'iPhone · Safari',
    icon: Smartphone,
    place: 'Holetown (approx.)',
    at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
];

function PasswordCard() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current: '', next: '', confirm: '' },
  });
  return (
    <Card>
      <SectionHeader title="Password" description="Requires the authentication backend." />
      <form
        noValidate
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
        onSubmit={handleSubmit(async () => {
          await new Promise((r) => setTimeout(r, 400));
          reset();
          toast.info('Demo only — your password was not changed', {
            description: 'Password changes will be handled by the authentication backend.',
          });
        })}
      >
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          error={errors.current?.message}
          {...register('current')}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.next?.message}
          helper="12+ characters with an uppercase letter and a number."
          {...register('next')}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
        <div className="md:col-span-3">
          <Button type="submit" variant="secondary" icon={KeyRound} loading={isSubmitting}>
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SecurityCard() {
  const [sessions, setSessions] = useState(SESSIONS);
  return (
    <Card>
      <SectionHeader title="Security" />
      <div className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-muted" aria-hidden="true" /> Two-factor authentication{' '}
            <Badge tone="muted">Not enabled</Badge>
          </p>
          <p className="mt-0.5 text-xs text-muted">Available once real authentication is connected.</p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            toast.info('Two-factor authentication requires the backend', {
              description: 'Nothing was enabled in this demo.',
            })
          }
        >
          Set up 2FA
        </Button>
      </div>
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-muted">
        Active sessions (sample)
      </h3>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            <s.icon className="h-5 w-5 text-muted" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {s.device}{' '}
                {s.current && (
                  <Badge tone="success" className="ml-1">
                    Current
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted">
                {s.place} · active {formatRelative(s.at)}
              </p>
            </div>
            {!s.current && (
              <Button
                size="sm"
                variant="ghost"
                icon={LogOut}
                onClick={() => {
                  setSessions((list) => list.filter((x) => x.id !== s.id));
                  toast.info('Sample session removed', { description: 'No real session was revoked.' });
                }}
              >
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ProfileForm({ values }) {
  const { setTheme } = usePreferences();
  const { form, onSubmit, actions, leaveGuard } = useSettingsForm({
    schema: profileSchema,
    values,
    save: async (data) => {
      const saved = await saveAccountSettings(data);
      setTheme(saved.theme);
      return saved;
    },
    invalidate: [['accountSettings']],
    successMessage: 'Profile saved (local demo settings)',
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const name = useWatch({ control, name: 'fullName' });
  return (
    <form noValidate onSubmit={onSubmit} className="space-y-6">
      <Card>
        <SectionHeader title="Profile" />
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="flex flex-col items-center gap-2">
            <Avatar name={name} size="xl" />
            <p className="text-2xs text-muted">Photo uploads need the backend.</p>
          </div>
          <div className="grid grid-cols-1 flex-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Full name"
              required
              error={errors.fullName?.message}
              {...register('fullName')}
            />
            <TextField
              label="Email address"
              type="email"
              required
              error={errors.email?.message}
              helper="Changing email will require verification once connected."
              {...register('email')}
            />
            <TextField label="Job title" {...register('jobTitle')} />
            <SelectField
              label="Preferred language"
              options={['English', 'Spanish', 'French']}
              {...register('language')}
            />
            <SelectField
              label="Timezone"
              options={['America/Barbados', 'America/New_York', 'Europe/London', 'UTC']}
              {...register('timezone')}
            />
            <SelectField
              label="Date format"
              options={['DD MMM YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']}
              {...register('dateFormat')}
            />
          </div>
        </div>
      </Card>
      <Card>
        <SectionHeader title="Preferences" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <SelectField
            label="Theme"
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            {...register('theme')}
          />
          <SelectField
            label="Email digest"
            options={[
              { value: 'off', label: 'Off' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
            ]}
            {...register('emailDigest')}
          />
          <Controller
            control={control}
            name="notifyMentions"
            render={({ field }) => (
              <Toggle
                label="Notify me when mentioned in notes"
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="notifyAssignments"
            render={({ field }) => (
              <Toggle
                label="Notify me about assigned reviews"
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
        <div className="mt-6 border-t border-line pt-4">{actions}</div>
      </Card>
      {leaveGuard}
    </form>
  );
}

export default function AccountSettingsPage() {
  const { data, isPending, isError, error, refetch } = useApiQuery('accountSettings', getAccountSettings);
  return (
    <>
      <PageHeader title="Settings" description="Your profile and account preferences." />
      <SettingsNav />
      <DemoNotice className="mb-6">
        Profile values are saved locally. Password, two-factor and session management require the
        authentication backend.
      </DemoNotice>
      {isError ? (
        <Card>
          <ErrorState message={error?.message} onRetry={refetch} />
        </Card>
      ) : isPending ? (
        <PageLoading />
      ) : (
        <div className="space-y-6">
          <ProfileForm values={data} />
          <PasswordCard />
          <SecurityCard />
        </div>
      )}
    </>
  );
}
