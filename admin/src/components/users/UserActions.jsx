import { useState } from 'react';
import { useApiMutation } from '@/hooks/useApi';
import { updateUser } from '@/services/userService';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { SelectField } from '@/components/common/Fields';
import { USER_ROLES, ACCOUNT_STATUSES } from '@/utils/constants';

/** Shared user status/role changes with confirmation (demo only — no real accounts change). */
export function useUserActions() {
  const confirm = useConfirm();
  const [roleTarget, setRoleTarget] = useState(null);
  const [role, setRole] = useState('');

  const mutation = useApiMutation(({ id, changes }) => updateUser(id, changes), {
    invalidate: [['users'], ['user']],
    success: (u, v) =>
      v.changes.role
        ? `${u.name} is now a ${USER_ROLES[u.role].toLowerCase()}`
        : `${u.name}’s account is now ${ACCOUNT_STATUSES[u.status].label.toLowerCase()}`,
    error: 'Couldn’t update the user',
    onSuccess: () => setRoleTarget(null),
  });

  const changeStatus = async (user, status) => {
    const ok = await confirm({
      title: `${status === 'active' ? 'Reactivate' : status === 'suspended' ? 'Suspend' : 'Deactivate'} ${user.name}?`,
      message:
        status === 'active'
          ? 'The user will be able to sign in again (once real accounts exist).'
          : 'In production this would block sign-in. In this demo only the displayed status changes.',
      confirmLabel: status === 'active' ? 'Reactivate' : status === 'suspended' ? 'Suspend' : 'Deactivate',
      tone: status === 'active' ? undefined : 'danger',
    });
    if (ok) mutation.mutate({ id: user.id, changes: { status } });
  };

  const openRole = (user) => {
    setRole(user.role);
    setRoleTarget(user);
  };

  const roleModal = (
    <Modal
      open={Boolean(roleTarget)}
      onOpenChange={(o) => !o && setRoleTarget(null)}
      title={`Change role for ${roleTarget?.name ?? ''}`}
      description="Demo roles only — permissions must be enforced by the backend."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => setRoleTarget(null)}>
            Cancel
          </Button>
          <Button
            disabled={!roleTarget || role === roleTarget.role}
            loading={mutation.isPending}
            onClick={() => mutation.mutate({ id: roleTarget.id, changes: { role } })}
          >
            Change role
          </Button>
        </>
      }
    >
      <SelectField
        label="Role"
        options={Object.entries(USER_ROLES).map(([v, l]) => ({ value: v, label: l }))}
        value={role}
        onValueChange={setRole}
      />
    </Modal>
  );

  return { changeStatus, openRole, roleModal, busy: mutation.isPending };
}
