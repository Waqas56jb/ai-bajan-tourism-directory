import { Controller, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import {
  getGeneralSettings,
  saveGeneralSettings,
  resetGeneralSettings,
  getAccountSettings,
  saveAccountSettings,
} from '@/services/settingsService';
import { usePreferences } from '@/context/PreferencesContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { SettingsNav, useSettingsForm } from '@/components/forms/SettingsShell';
import { Card } from '@/components/common/Card';
import { SectionHeader } from '@/components/common/SectionHeader';
import { TextField } from '@/components/common/Fields';
import { LogoMark } from '@/components/layout/Logo';
import { ErrorState, PageLoading } from '@/components/common/States';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #0f2a3d.');
const schema = z.object({
  logoText: z.string().trim().min(2, 'Logo text is required.').max(30),
  primaryColor: hex,
  secondaryColor: hex,
  accentColor: hex,
});

function ColorField({ control, name, label, error }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div>
          <label htmlFor={`c-${name}`} className="label">
            {label}
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              aria-label={`Pick ${label.toLowerCase()}`}
              className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1"
              value={/^#[0-9a-f]{6}$/i.test(field.value ?? '') ? field.value : '#000000'}
              onChange={(e) => field.onChange(e.target.value)}
            />
            <input
              id={`c-${name}`}
              className="field font-mono"
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
              aria-invalid={error ? 'true' : 'false'}
            />
          </div>
          {error && <p className="error-text">{error}</p>}
        </div>
      )}
    />
  );
}

function BrandingForm({ values }) {
  const { form, onSubmit, actions, leaveGuard } = useSettingsForm({
    schema,
    values,
    save: saveGeneralSettings,
    reset: resetGeneralSettings,
    invalidate: [['generalSettings']],
    successMessage: 'Branding saved (local demo configuration)',
  });
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const v = useWatch({ control });
  return (
    <form noValidate onSubmit={onSubmit}>
      <Card>
        <SectionHeader
          title="Branding"
          description="Preview only — the public website’s theme is not changed from here."
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Logo text"
              required
              error={errors.logoText?.message}
              {...register('logoText')}
            />
            <ColorField
              control={control}
              name="primaryColor"
              label="Primary colour"
              error={errors.primaryColor?.message}
            />
            <ColorField
              control={control}
              name="secondaryColor"
              label="Secondary colour"
              error={errors.secondaryColor?.message}
            />
            <ColorField
              control={control}
              name="accentColor"
              label="Accent colour"
              error={errors.accentColor?.message}
            />
          </div>
          <div className="space-y-4">
            <div>
              <p className="label">Logo preview</p>
              <div
                className="flex items-center gap-3 rounded-xl border border-line p-4"
                style={{ backgroundColor: '#fcfaf6' }}
              >
                <LogoMark className="h-10 w-10" />
                <span className="text-lg font-semibold" style={{ color: v.primaryColor }}>
                  {v.logoText || 'Logo'}
                </span>
              </div>
            </div>
            <div>
              <p className="label">Favicon preview</p>
              <div className="flex items-center gap-2 rounded-xl border border-line bg-subtle/60 p-3 text-xs text-muted">
                <LogoMark className="h-4 w-4" /> {v.logoText || 'AI Bajan'} — browser tab
              </div>
            </div>
            <div className="flex gap-2" aria-label="Colour swatches">
              {['primaryColor', 'secondaryColor', 'accentColor'].map((k) => (
                <span
                  key={k}
                  className="h-10 flex-1 rounded-lg ring-1 ring-line"
                  style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(v[k] ?? '') ? v[k] : 'transparent' }}
                  title={k}
                />
              ))}
            </div>
            <button
              type="button"
              className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: v.primaryColor }}
            >
              Sample button
            </button>
          </div>
        </div>
        <div className="mt-6 border-t border-line pt-4">{actions}</div>
      </Card>
      {leaveGuard}
    </form>
  );
}

function ThemeCard() {
  const { theme, setTheme } = usePreferences();
  const account = useApiQuery('accountSettings', getAccountSettings);
  const save = useApiMutation((t) => saveAccountSettings({ ...account.data, theme: t }), {
    invalidate: [['accountSettings']],
    success: 'Theme preference saved',
    error: 'Couldn’t save theme',
  });
  const options = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];
  return (
    <Card>
      <SectionHeader title="Dashboard theme" description="Applies to this admin dashboard in this browser." />
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={theme === o.value}
            disabled={!account.data}
            onClick={() => {
              setTheme(o.value);
              save.mutate(o.value);
            }}
            className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${theme === o.value ? 'border-accent bg-accent/5' : 'border-line hover:border-muted/50'}`}
          >
            <o.icon className="h-5 w-5 text-accent" aria-hidden="true" />
            <span className="text-sm font-medium">{o.label}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

export default function AppearanceSettingsPage() {
  const { data, isPending, isError, error, refetch } = useApiQuery('generalSettings', getGeneralSettings);
  return (
    <>
      <PageHeader title="Settings" description="Branding and appearance." />
      <SettingsNav />
      <div className="space-y-6">
        <ThemeCard />
        {isError ? (
          <Card>
            <ErrorState message={error?.message} onRetry={refetch} />
          </Card>
        ) : isPending ? (
          <PageLoading />
        ) : (
          <BrandingForm values={data} />
        )}
      </div>
    </>
  );
}
