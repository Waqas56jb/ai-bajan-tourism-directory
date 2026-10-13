/**
 * Accessible overlays built on Radix Dialog: focus trapping, Escape to close, focus return,
 * scroll locking and aria wiring come from Radix; motion from Framer Motion.
 */
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = '',
  hideTitle = false,
  placement = 'center',
}) {
  const top = placement === 'top';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[80] bg-navy-900/70 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className={`fixed left-1/2 ${top ? 'top-[8vh]' : 'top-1/2'} z-[81] max-h-[86vh] w-[min(92vw,640px)] overflow-y-auto rounded-card bg-white p-6 shadow-lift focus:outline-none ${className}`}
                style={{ x: '-50%', y: top ? 0 : '-50%' }}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <Dialog.Title className={hideTitle ? 'sr-only' : 'text-xl font-extrabold'}>
                  {title}
                </Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-1 text-muted">{description}</Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{title}</Dialog.Description>
                )}
                {children}
                <Dialog.Close className="icon-btn absolute right-3 top-3" aria-label="Close">
                  <X className="h-5 w-5" aria-hidden="true" />
                </Dialog.Close>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

/** Side drawer (mobile navigation, mobile filters). */
export function Drawer({
  open,
  onOpenChange,
  title,
  side = 'right',
  children,
  footer,
  className = '',
  titleHidden = false,
  header,
}) {
  const fromX = side === 'right' ? '100%' : '-100%';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[70] bg-navy-900/55 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className={`fixed inset-y-0 ${side === 'right' ? 'right-0' : 'left-0'} z-[71] flex w-[min(100vw,420px)] flex-col bg-cream shadow-lift focus:outline-none ${className}`}
                initial={{ x: fromX }}
                animate={{ x: 0 }}
                exit={{ x: fromX }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
                  {header ?? null}
                  <Dialog.Title className={titleHidden ? 'sr-only' : 'text-lg font-extrabold'}>
                    {title}
                  </Dialog.Title>
                  <Dialog.Description className="sr-only">{title}</Dialog.Description>
                  <Dialog.Close
                    className="icon-btn -mr-2 shrink-0"
                    aria-label={`Close ${title.toLowerCase()}`}
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </Dialog.Close>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
                {footer && <div className="border-t border-line bg-white px-5 py-4">{footer}</div>}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
