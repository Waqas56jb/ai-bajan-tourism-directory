import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RotateCcw, Save } from 'lucide-react';
import { SETTINGS_NAV } from '@/config/navigation';
import { useApiMutation } from '@/hooks/useApi';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';

export function SettingsNav() {
  return (
    <nav
      aria-label="Settings sections"
      className="scrollbar-thin mb-6 flex gap-1 overflow-x-auto border-b border-line"
    >
      {SETTINGS_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * A settings form bound to a settings document. Provides save / cancel / reset-to-defaults,
 * an unsaved-changes indicator and a leave-page guard. The form works on the WHOLE document
 * so pages that edit different parts of it don't overwrite each other.
 */
export function useSettingsForm({
  schema,
  values,
  save,
  reset: resetFn,
  invalidate,
  successMessage = 'Settings saved (local demo configuration)',
}) {
  const confirm = useConfirm();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: values });
  const { reset, formState } = form;

  useEffect(() => {
    if (values) reset(values);
  }, [values, reset]);

  const saveMutation = useApiMutation(save, {
    invalidate,
    success: successMessage,
    error: 'Couldn’t save settings',
    onSuccess: (data) => reset(data),
  });
  const resetMutation = useApiMutation(resetFn, {
    invalidate,
    success: 'Settings restored to demo defaults',
    error: 'Reset failed',
    onSuccess: (data) => reset(data),
  });
  const blocker = useUnsavedChanges(formState.isDirty);

  const onSubmit = form.handleSubmit((data) => saveMutation.mutate({ ...values, ...data }));

  const actions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {formState.isDirty && (
        <Badge tone="warning" dot>
          Unsaved changes
        </Badge>
      )}
      {resetFn && (
        <Button
          variant="ghost"
          icon={RotateCcw}
          loading={resetMutation.isPending}
          onClick={async () => {
            if (
              await confirm({
                title: 'Reset to defaults?',
                message: 'All values on every settings tab will return to the original demo configuration.',
                confirmLabel: 'Reset',
                tone: 'danger',
              })
            )
              resetMutation.mutate();
          }}
        >
          Reset to defaults
        </Button>
      )}
      <Button variant="outline" disabled={!formState.isDirty} onClick={() => reset(values)}>
        Cancel
      </Button>
      <Button type="submit" icon={Save} loading={saveMutation.isPending} disabled={!formState.isDirty}>
        Save changes
      </Button>
    </div>
  );

  const leaveGuard = (
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
      <p className="text-sm text-muted">Your settings changes haven’t been saved.</p>
    </Modal>
  );

  return { form, onSubmit, actions, leaveGuard };
}
