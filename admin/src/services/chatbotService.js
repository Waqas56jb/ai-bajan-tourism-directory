/**
 * Chatbot conversations + settings (DEMO). No AI API is called from the admin dashboard.
 * Settings are stored locally and are NOT applied to any live assistant.
 */
import { db } from './db';
import { simulate, newId, notFound, createDocument } from './mockApi';
import { logActivity } from './activityService';
import { getSessionAdmin } from './authService';
import { dailySeries, chatTopics } from '@/data/mockDashboard';

export const getConversations = () =>
  simulate(() => [...db.conversations.all()].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)));

export const getConversationById = (id) =>
  simulate(() => {
    const c = db.conversations.find(id);
    if (!c) throw notFound('Conversation');
    return c;
  });

export const setConversationReview = (id, reviewStatus) =>
  simulate(
    () => {
      if (!db.conversations.find(id)) throw notFound('Conversation');
      return db.conversations.patch(id, { reviewStatus });
    },
    { write: true },
  );

/** Internal notes are admin-only and never shown to visitors or used by the chatbot. */
export const addConversationNote = (id, text) =>
  simulate(
    () => {
      const c = db.conversations.find(id);
      if (!c) throw notFound('Conversation');
      const note = {
        id: newId('note'),
        author: getSessionAdmin()?.name ?? 'Demo administrator',
        text: text.trim(),
        at: new Date().toISOString(),
      };
      return db.conversations.patch(id, { notes: [...(c.notes ?? []), note] });
    },
    { write: true },
  );

/** Aggregate SAMPLE metrics for a window of days. */
export const getChatbotStats = (days = 30) =>
  simulate(() => {
    const window = dailySeries.slice(-days);
    const previous = dailySeries.slice(-days * 2, -days);
    const sum = (rows, k) => rows.reduce((acc, r) => acc + r[k], 0);
    const total = (rows) => ({
      conversations: sum(rows, 'conversations'),
      questions: sum(rows, 'questions'),
      answered: sum(rows, 'answered'),
      fallback: sum(rows, 'fallback'),
      positive: sum(rows, 'positive'),
      negative: sum(rows, 'negative'),
      latencyMs: rows.length ? Math.round(sum(rows, 'latencyMs') / rows.length) : 0,
    });
    const current = total(window);
    return {
      current,
      previous: previous.length ? total(previous) : null,
      satisfaction:
        current.positive + current.negative ? current.positive / (current.positive + current.negative) : null,
      series: window.map((d) => ({
        date: d.date,
        conversations: d.conversations,
        answered: d.answered,
        fallback: d.fallback,
      })),
      topics: chatTopics,
      feedback: [
        { name: 'Helpful', value: current.positive },
        { name: 'Not helpful', value: current.negative },
        {
          name: 'No rating',
          value: Math.max(0, current.conversations - current.positive - current.negative),
        },
      ],
    };
  });

export const DEFAULT_CHATBOT_SETTINGS = {
  enabled: true,
  displayName: 'AI Bajan',
  welcomeMessage: 'Hello! I’m AI Bajan, your guide to discovering Barbados. What are you looking for?',
  description: 'Answers questions using the AI Bajan directory and approved travel information.',
  defaultLanguage: 'English',
  supportedLanguages: ['English'],
  suggestedQuestions: [
    'Find restaurants near Holetown.',
    'Show guesthouses in Christ Church.',
    'Which businesses offer snorkeling tours?',
  ],
  brandColor: '#0d948e',
  avatar: 'compass',
  widgetTitle: 'Ask AI Bajan',
  widgetSubtitle: 'Your Barbados travel guide',
  welcomeScreen: 'Ask about places to eat, stay and explore. I’ll answer from the AI Bajan directory.',
  answerStyle: 'concise',
  responseLength: 'medium',
  tone: 'friendly',
  includeSources: true,
  approvedOnly: true,
  fallbackMessage:
    'I couldn’t find that in the AI Bajan directory. Try a broader question, or contact the business directly.',
  askClarifying: true,
  showEscalation: true,
  escalationText:
    'For anything urgent, please contact the business directly or use the AI Bajan contact page.',
  includeListings: true,
  includeFaqs: true,
  includeDocuments: true,
  excludeDrafts: true,
  excludeRejected: true,
  excludePrivateNotes: true,
  maxResponseChars: 1200,
  rateLimitDescription: 'Up to 20 messages per visitor per 10 minutes (to be enforced by the API).',
  sensitiveDataNotice:
    'Please don’t share passwords, payment details or other sensitive information in this chat.',
  outOfScopeMessage: 'I can only help with Barbados travel and the AI Bajan directory.',
  errorFallbackMessage: 'Sorry — I’m having trouble answering right now. Please try again shortly.',
  sourceAttribution: 'inline',
};

const settingsDoc = createDocument('chatbot_settings', DEFAULT_CHATBOT_SETTINGS);

export const getChatbotSettings = () => simulate(() => settingsDoc.get());

export const saveChatbotSettings = (settings) =>
  simulate(
    () => {
      settingsDoc.set(settings);
      logActivity({
        action: 'chatbot_settings',
        entityType: 'settings',
        entityId: 'chatbot',
        entityName: 'Chatbot settings',
        summary: 'Chatbot settings saved (local demo configuration).',
      });
      return settingsDoc.get();
    },
    { write: true },
  );

export const resetChatbotSettings = () =>
  simulate(
    () => {
      settingsDoc.reset();
      return settingsDoc.get();
    },
    { write: true },
  );
