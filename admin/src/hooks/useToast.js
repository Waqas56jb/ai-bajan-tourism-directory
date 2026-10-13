import { toast } from 'sonner';

/** Thin wrapper so the toast library can be swapped without touching pages. */
export function useToast() {
  return {
    success: (title, description) => toast.success(title, { description }),
    error: (title, description) => toast.error(title, { description }),
    info: (title, description) => toast.info(title, { description }),
    warning: (title, description) => toast.warning(title, { description }),
  };
}
