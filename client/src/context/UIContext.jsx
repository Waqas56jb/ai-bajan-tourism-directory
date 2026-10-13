import { useCallback, useEffect, useMemo, useState } from 'react';
import { useChatState } from '@/hooks/useChatbot';
import { ChatContext, UIContext } from './chatContext';

const SESSION_KEY = 'aibajan.chatOpen';

function readSession() {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSession(open) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, open ? '1' : '0');
  } catch {
    /* storage unavailable (private mode) — nothing to persist */
  }
}

/**
 * Lightweight global UI state:
 *  - chat window visibility (remembered for the current browser session only)
 *  - the chat conversation itself (in memory)
 *  - announcement bar dismissal (session only)
 */
export function UIProvider({ children }) {
  const chat = useChatState();
  const [chatView, setChatView] = useState(() => (readSession() ? 'open' : 'closed')); // closed | open | minimized
  const [announcementDismissed, setAnnouncementDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem('aibajan.announcement') === 'dismissed';
    } catch {
      return false;
    }
  });

  useEffect(() => writeSession(chatView === 'open'), [chatView]);

  const { send, setContext } = chat;

  /**
   * Open the assistant, optionally attaching a business as context and/or sending a prompt.
   * @param {{ prompt?: string, business?: { slug: string, name: string, category?: string, area?: string } }} [opts]
   */
  const openChat = useCallback(
    (opts = {}) => {
      setChatView('open');
      if (opts.business !== undefined) setContext(opts.business);
      if (opts.prompt) {
        // let the window mount first so the new message animates in
        setTimeout(() => send(opts.prompt), 60);
      }
    },
    [send, setContext],
  );

  const dismissAnnouncement = useCallback(() => {
    setAnnouncementDismissed(true);
    try {
      window.sessionStorage.setItem('aibajan.announcement', 'dismissed');
    } catch {
      /* ignore */
    }
  }, []);

  const ui = useMemo(
    () => ({
      chatView,
      isChatOpen: chatView === 'open',
      openChat,
      closeChat: () => setChatView('closed'),
      minimizeChat: () => setChatView('minimized'),
      announcementDismissed,
      dismissAnnouncement,
    }),
    [chatView, openChat, announcementDismissed, dismissAnnouncement],
  );

  return (
    <UIContext.Provider value={ui}>
      <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>
    </UIContext.Provider>
  );
}
