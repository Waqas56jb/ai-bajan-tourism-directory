import { useQuery } from '@tanstack/react-query';
import { getAssistantStatus } from '@/lib/services';

/**
 * Is the public AI assistant switched on? It stays off until the backend is connected to a real AI
 * model, so visitors never receive keyword-only answers. While loading (or if the status check fails) the assistant is treated as available.
 */
export function useAssistant() {
  const q = useQuery({ queryKey: ['assistant-status'], queryFn: getAssistantStatus, staleTime: 5 * 60_000, retry: 1 });
  return { available: q.data ? q.data.available !== false : true, loading: q.isPending, status: q.data };
}
