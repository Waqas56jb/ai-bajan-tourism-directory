import { lazy, Suspense, useEffect, useRef } from 'react';
import { useAssistant } from '@/hooks/useAssistant';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { useUI } from '@/hooks/useUI';
import { useChatbot } from '@/hooks/useChatbot';
import { LogoMark } from '@/components/common/Logo';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { useIsDesktop } from '@/hooks/useMediaQuery';

const loadWindow = () => import('./AIChatbotWindow');
const AIChatbotWindow = lazy(loadWindow);

/**
 * Floating entry point to the assistant, present on every page. The chat window code
 * (including the Markdown renderer) is only downloaded when first needed.
 */
export function AIChatbotLauncher() {
  const { chatView, openChat } = useUI();
  const { messages } = useChatbot();
  const launcherRef = useRef(null);
  const isDesktop = useIsDesktop();
  const hasConversation = messages.length > 1;
  // The floating launcher (bottom-right) is the assistant's entry point on every page. It is only
  // hidden if the server reports the assistant as switched off.
  const { available } = useAssistant();
  const hideLauncher = !available;

  useLockBodyScroll(chatView === 'open' && !isDesktop);

  // Return focus to the launcher when the chat window closes or minimises.
  const previousView = useRef(chatView);
  useEffect(() => {
    if (previousView.current === 'open' && chatView !== 'open') {
      const id = setTimeout(() => launcherRef.current?.focus({ preventScroll: true }), 80);
      previousView.current = chatView;
      return () => clearTimeout(id);
    }
    previousView.current = chatView;
    return undefined;
  }, [chatView]);

  return (
    <>
      <AnimatePresence>
        {chatView !== 'open' && !hideLauncher && (
          <motion.div
            key="launcher"
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[55] sm:bottom-6 sm:right-6"
          >
            <button
              ref={launcherRef}
              type="button"
              onClick={() => openChat()}
              onMouseEnter={loadWindow}
              onFocus={loadWindow}
              aria-label={
                chatView === 'minimized'
                  ? 'Continue your conversation with AI Bajan'
                  : 'Open the AI Bajan assistant'
              }
              className="pulse-ring group relative isolate flex items-center gap-2.5 rounded-full bg-navy p-1.5 text-white shadow-lift transition-transform hover:-translate-y-0.5 focus-visible:outline-offset-4 sm:pr-5"
            >
              <span className="relative">
                <LogoMark className="h-11 w-11" />
                {(chatView === 'minimized' || hasConversation) && (
                  <span
                    className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-navy bg-coral"
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="hidden text-sm font-bold sm:inline">
                {chatView === 'minimized' ? 'Continue chat' : 'Ask AI Bajan'}
              </span>
              <MessageCircle className="hidden h-4 w-4 text-lagoon sm:block" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {chatView === 'open' && (
          <Suspense key="chat-window" fallback={null}>
            <AIChatbotWindow />
          </Suspense>
        )}
      </AnimatePresence>
    </>
  );
}
