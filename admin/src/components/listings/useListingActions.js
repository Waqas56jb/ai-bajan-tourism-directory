import {
  Archive,
  CheckCircle2,
  Eye,
  ExternalLink,
  MessageSquareWarning,
  Pencil,
  Send,
  Star,
  StarOff,
  Trash2,
  Undo2,
  XCircle,
  BadgeCheck,
  BadgeX,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { useApiMutation } from '@/hooks/useApi';
import { deleteListing, setListingStatus, setListingVerified, toggleListingFeatured } from '@/services/listingService';

/** Errors are already reported by toast; resolve to a success flag instead of rejecting. */
const safe = (promise) =>
  promise.then(
    () => true,
    () => false,
  );

const INVALIDATE = [['listings'], ['listing'], ['categories'], ['locations'], ['syncJobs'], ['featured']];

/**
 * All listing status actions with the right confirmations, plus a helper that returns only the
 * actions valid for a listing's current status (used to build row/drawer menus).
 */
export function useListingActions() {
  const confirm = useConfirm();
  const navigate = useNavigate();

  const status = useApiMutation(({ id, status: s, meta }) => setListingStatus(id, s, meta), {
    invalidate: INVALIDATE,
    success: (l, v) =>
      v.meta?.approve
        ? `Approved and published “${l.name}”`
        : v.meta?.reason
          ? `Rejected “${l.name}”`
          : v.meta?.feedback
            ? `Changes requested for “${l.name}”`
            : `“${l.name}” is now ${v.status}`,
    error: 'Status change failed',
  });
  const featured = useApiMutation((id) => toggleListingFeatured(id), {
    invalidate: INVALIDATE,
    success: (l) =>
      l.featured ? `“${l.name}” marked as featured` : `Featured flag removed from “${l.name}”`,
    error: 'Couldn’t update featured status',
  });
  const verify = useApiMutation(({ id, verified }) => setListingVerified(id, verified), {
    invalidate: INVALIDATE,
    success: (l) => (l.verified ? `“${l.name}” is now Verified by AI Bajan` : `Verification removed from “${l.name}”`),
    error: 'Couldn’t update verification',
  });
  const remove = useApiMutation((id) => deleteListing(id), {
    invalidate: INVALIDATE,
    success: 'Listing deleted',
    error: 'Delete failed',
  });

  const publish = (l) => safe(status.mutateAsync({ id: l.id, status: 'published' }));
  const unpublish = async (l) => {
    const ok = await confirm({
      title: 'Unpublish listing?',
      message: `“${l.name}” will be hidden from the public site and removed from chatbot knowledge (simulated).`,
      confirmLabel: 'Unpublish',
    });
    if (ok) await safe(status.mutateAsync({ id: l.id, status: 'draft' }));
  };
  const approve = (l) => safe(status.mutateAsync({ id: l.id, status: 'published', meta: { approve: true } }));
  const reject = async (l) => {
    const { confirmed, value } = await confirm({
      title: `Reject “${l.name}”?`,
      message: 'The submitter will see this reason once notifications are connected.',
      confirmLabel: 'Reject listing',
      tone: 'danger',
      input: {
        label: 'Reason for rejection',
        required: true,
        placeholder: 'e.g. Missing proof of business registration.',
      },
    });
    if (confirmed) await safe(status.mutateAsync({ id: l.id, status: 'rejected', meta: { reason: value } }));
  };
  const requestChanges = async (l) => {
    const { confirmed, value } = await confirm({
      title: 'Request changes',
      message: `Send “${l.name}” back to the submitter as a draft with your feedback.`,
      confirmLabel: 'Request changes',
      input: {
        label: 'Feedback for the submitter',
        required: true,
        placeholder: 'e.g. Please add opening hours and a clearer photo.',
      },
    });
    if (confirmed) await safe(status.mutateAsync({ id: l.id, status: 'draft', meta: { feedback: value } }));
  };
  const archive = async (l) => {
    const ok = await confirm({
      title: 'Archive listing?',
      message: `“${l.name}” will be hidden everywhere and excluded from chatbot knowledge. You can restore it later.`,
      confirmLabel: 'Archive',
      tone: 'danger',
    });
    if (ok) await safe(status.mutateAsync({ id: l.id, status: 'archived' }));
  };
  const restore = (l) => safe(status.mutateAsync({ id: l.id, status: 'draft' }));
  const submitForReview = (l) => safe(status.mutateAsync({ id: l.id, status: 'pending' }));
  const destroy = async (l, { onDone } = {}) => {
    const ok = await confirm({
      title: 'Delete listing permanently?',
      message: `“${l.name}” and its featured placements will be removed from the demo data. This can’t be undone (except by resetting demo data).`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) {
      if (await safe(remove.mutateAsync(l.id))) onDone?.();
    }
  };

  /** Menu items appropriate for a listing's status. */
  const menuFor = (l, { includeView = true, onDeleted } = {}) =>
    [
      includeView && { label: 'View details', icon: Eye, to: `/listings/${l.id}` },
      { label: 'Edit', icon: Pencil, to: `/listings/${l.id}/edit` },
      { label: 'Preview', icon: ExternalLink, to: `/listings/${l.id}/preview` },
      l.status === 'pending' && {
        label: 'Approve',
        icon: CheckCircle2,
        onSelect: () => approve(l),
        separatorBefore: true,
      },
      l.status === 'pending' && {
        label: 'Request changes',
        icon: MessageSquareWarning,
        onSelect: () => requestChanges(l),
      },
      l.status === 'pending' && { label: 'Reject', icon: XCircle, onSelect: () => reject(l), tone: 'danger' },
      (l.status === 'draft' || l.status === 'rejected') && {
        label: 'Publish',
        icon: Send,
        onSelect: () => publish(l),
        separatorBefore: true,
      },
      l.status === 'draft' && { label: 'Submit for review', icon: Send, onSelect: () => submitForReview(l) },
      l.status === 'published' && {
        label: 'Unpublish',
        icon: Undo2,
        onSelect: () => unpublish(l),
        separatorBefore: true,
      },
      l.status === 'archived' && {
        label: 'Restore as draft',
        icon: Undo2,
        onSelect: () => restore(l),
        separatorBefore: true,
      },
      l.status !== 'archived' && {
        label: l.featured ? 'Unfeature' : 'Feature',
        icon: l.featured ? StarOff : Star,
        onSelect: () => featured.mutate(l.id),
      },
      l.status === 'published' && {
        label: l.verified ? 'Remove “Verified” badge' : 'Mark “Verified by AI Bajan”',
        icon: l.verified ? BadgeX : BadgeCheck,
        onSelect: () => verify.mutate({ id: l.id, verified: !l.verified }),
      },
      l.status !== 'archived' && { label: 'Archive', icon: Archive, onSelect: () => archive(l) },
      {
        label: 'Delete',
        icon: Trash2,
        tone: 'danger',
        separatorBefore: true,
        onSelect: () => destroy(l, { onDone: onDeleted }),
      },
    ].filter(Boolean);

  return {
    publish,
    unpublish,
    approve,
    reject,
    requestChanges,
    archive,
    restore,
    submitForReview,
    toggleFeatured: (l) => featured.mutate(l.id),
    destroy,
    menuFor,
    isWorking: status.isPending || featured.isPending || remove.isPending,
    navigate,
  };
}
