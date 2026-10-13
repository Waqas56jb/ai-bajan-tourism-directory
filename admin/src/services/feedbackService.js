import { db } from './db';
import { simulate, newId, notFound } from './mockApi';
import { getSessionAdmin } from './authService';

const nowIso = () => new Date().toISOString();

export const getFeedback = () =>
  simulate(() => [...db.feedback.all()].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)));

export const updateFeedback = (id, changes) =>
  simulate(
    () => {
      if (!db.feedback.find(id)) throw notFound('Feedback');
      return db.feedback.patch(id, { ...changes, updatedAt: nowIso() });
    },
    { write: true },
  );

export const addFeedbackNote = (id, text) =>
  simulate(
    () => {
      const fb = db.feedback.find(id);
      if (!fb) throw notFound('Feedback');
      const note = {
        id: newId('fn'),
        author: getSessionAdmin()?.name ?? 'Demo administrator',
        text: text.trim(),
        at: nowIso(),
      };
      return db.feedback.patch(id, { notes: [...(fb.notes ?? []), note], updatedAt: nowIso() });
    },
    { write: true },
  );
