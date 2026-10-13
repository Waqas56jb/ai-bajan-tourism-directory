import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/** Read data from a service function with loading/error/retry handled by TanStack Query. */
export function useApiQuery(key, fn, options = {}) {
  return useQuery({ queryKey: Array.isArray(key) ? key : [key], queryFn: fn, ...options });
}

/**
 * Run a service write. Success toasts appear only after the (mock) operation completes;
 * failures show an error toast and leave form input untouched so the user can retry.
 *
 * @param {(vars) => Promise} fn
 * @param {{ invalidate?: string[][], success?: string | ((data, vars) => string), error?: string, onSuccess?: Function }} opts
 */
export function useApiMutation(fn, { invalidate = [], success, error, onSuccess, onError } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (data, vars) => {
      await Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k })));
      // Activity log and notifications change on most writes
      qc.invalidateQueries({ queryKey: ['activity'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      const message = typeof success === 'function' ? success(data, vars) : success;
      if (message) toast.success(message);
      onSuccess?.(data, vars);
    },
    onError: (err, vars) => {
      toast.error(error ?? 'Something went wrong', { description: err?.message });
      onError?.(err, vars);
    },
  });
}
