/**
 * Accessible dialogs built on Radix Dialog (focus trap, Escape, focus return, scroll lock,
 * aria wiring) with Framer Motion transitions.
 */
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

const overlay = (
  <Dialog.Overlay asChild forceMount>
    <motion.div
      className="fixed inset-0 z-[70] bg-navy-800/40 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    />
  </Dialog.Overlay>
);

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocusRef,
}) {
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {overlay}
            <div className="fixed inset-0 z-[71] flex items-end justify-center p-0 sm:items-center sm:p-4">
              <Dialog.Content
                asChild
                forceMount
                onOpenAutoFocus={(e) => {
                  if (initialFocusRef?.current) {
                    e.preventDefault();
                    initialFocusRef.current.focus();
                  }
                }}
              >
                <motion.div
                  className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-pop focus:outline-none sm:rounded-2xl ${widths[size]}`}
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                    <div className="min-w-0">
                      <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
                      {description ? (
                        <Dialog.Description className="mt-0.5 text-sm text-muted">
                          {description}
                        </Dialog.Description>
                      ) : (
                        <Dialog.Description className="sr-only">{title}</Dialog.Description>
                      )}
                    </div>
                    <Dialog.Close
                      className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Dialog.Close>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
                  {footer && (
                    <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-subtle/50 px-5 py-3">
                      {footer}
                    </div>
                  )}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

/** Right-hand drawer for record details. */
export function Drawer({ open, onOpenChange, title, description, children, footer, width = 'max-w-lg' }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {overlay}
            <Dialog.Content asChild forceMount>
              <motion.div
                className={`fixed inset-y-0 right-0 z-[71] flex w-full flex-col border-l border-line bg-surface shadow-pop focus:outline-none ${width}`}
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <Dialog.Title className="truncate text-base font-semibold text-ink">{title}</Dialog.Title>
                    {description ? (
                      <Dialog.Description className="mt-0.5 text-sm text-muted">
                        {description}
                      </Dialog.Description>
                    ) : (
                      <Dialog.Description className="sr-only">{title}</Dialog.Description>
                    )}
                  </div>
                  <Dialog.Close
                    className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink"
                    aria-label="Close panel"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Dialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
                {footer && (
                  <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-subtle/50 px-5 py-3">
                    {footer}
                  </div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
