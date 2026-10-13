import { useCallback, useContext, useReducer, useRef } from 'react';
import { sendChatMessage } from '@/lib/services';
import { ChatContext } from '@/context/chatContext';

const MAX_MESSAGE_LENGTH = 1000;

let idCounter = 0;
const nextId = () => `m${Date.now().toString(36)}${(idCounter += 1)}`;

export const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  status: 'ok',
  content:
    'Hello! I’m **AI Bajan**, your guide to discovering Barbados. Tell me what you’re looking for, and I’ll help you explore the available businesses and travel information.',
  businesses: [],
  sources: [],
  followUps: [],
};

const initialState = { messages: [WELCOME_MESSAGE], pending: false, context: null };

function reducer(state, action) {
  switch (action.type) {
    case 'add':
      return { ...state, messages: [...state.messages, action.message] };
    case 'remove':
      return { ...state, messages: state.messages.filter((m) => m.id !== action.id) };
    case 'pending':
      return { ...state, pending: action.value };
    case 'context':
      return { ...state, context: action.context };
    case 'clear':
      return { ...initialState, context: null };
    default:
      return state;
  }
}

/**
 * Conversation state + transport. Lives in ChatProvider so the conversation survives route
 * changes and can be opened from anywhere (e.g. "Ask AI Bajan about this business").
 */
export function useChatState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const requestRef = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const request = useCallback(async (text) => {
    const requestId = (requestRef.current += 1);
    dispatch({ type: 'pending', value: true });
    try {
      const history = stateRef.current.messages
        .filter((m) => m.id !== 'welcome' && m.status === 'ok')
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await sendChatMessage({
        message: text,
        history,
        context: stateRef.current.context
          ? { businessSlug: stateRef.current.context.slug }
          : undefined,
      });
      if (requestId !== requestRef.current) return; // conversation was cleared meanwhile
      dispatch({
        type: 'add',
        message: {
          id: nextId(),
          role: 'assistant',
          status: 'ok',
          content: typeof res?.reply === 'string' ? res.reply : '',
          businesses: Array.isArray(res?.businesses) ? res.businesses : [],
          sources: Array.isArray(res?.sources) ? res.sources : [],
          followUps: Array.isArray(res?.followUps) ? res.followUps.slice(0, 3) : [],
          mode: res?.meta?.mode,
        },
      });
    } catch (error) {
      if (requestId !== requestRef.current) return;
      dispatch({
        type: 'add',
        message: {
          id: nextId(),
          role: 'assistant',
          status: 'error',
          content: error?.message || 'Something went wrong.',
          retryText: text,
          retryable: error?.retryable !== false,
        },
      });
    } finally {
      if (requestId === requestRef.current) dispatch({ type: 'pending', value: false });
    }
  }, []);

  /** @returns {boolean} false when the message was empty / invalid and nothing was sent. */
  const send = useCallback(
    (raw) => {
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (!text || text.length > MAX_MESSAGE_LENGTH || stateRef.current.pending) return false;
      dispatch({
        type: 'add',
        message: { id: nextId(), role: 'user', status: 'ok', content: text },
      });
      request(text);
      return true;
    },
    [request],
  );

  const retry = useCallback(
    (messageId) => {
      const failed = stateRef.current.messages.find((m) => m.id === messageId);
      if (!failed?.retryText || stateRef.current.pending) return;
      dispatch({ type: 'remove', id: messageId });
      request(failed.retryText);
    },
    [request],
  );

  const clear = useCallback(() => {
    requestRef.current += 1;
    dispatch({ type: 'clear' });
  }, []);

  const setContext = useCallback((context) => dispatch({ type: 'context', context }), []);

  return { ...state, send, retry, clear, setContext };
}

export function useChatbot() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatbot must be used inside <ChatProvider>.');
  return ctx;
}
