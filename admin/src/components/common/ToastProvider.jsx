import { Toaster } from 'sonner';

/** Toast notifications (sonner). Use via hooks/useToast or `toast` from sonner. */
export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      closeButton
      richColors
      duration={4000}
      toastOptions={{ className: 'font-sans', style: { fontFamily: 'Inter, system-ui, sans-serif' } }}
    />
  );
}
