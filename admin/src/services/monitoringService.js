/**
 * System health and error logs (DEMO). No health checks are performed and no service is
 * contacted. Statuses are sample values clearly labelled "Not connected" in the UI.
 */
import { db } from './db';
import { simulate, notFound } from './mockApi';
import { mockServices, mockIncidentHistory } from '@/data/mockSystemHealth';

export const getSystemHealth = () =>
  simulate(() => ({ services: mockServices, history: mockIncidentHistory, connected: false }));

export const getErrorLogs = () =>
  simulate(() => [...db.errorLogs.all()].sort((a, b) => new Date(b.at) - new Date(a.at)));

export const updateErrorLog = (id, changes) =>
  simulate(
    () => {
      if (!db.errorLogs.find(id)) throw notFound('Error log');
      return db.errorLogs.patch(id, changes);
    },
    { write: true },
  );

/* ----------------------------- Notifications ---------------------------- */

export const getNotifications = () =>
  simulate(() => [...db.notifications.all()].sort((a, b) => new Date(b.at) - new Date(a.at)));

export const markNotificationRead = (id) => simulate(() => db.notifications.patch(id, { read: true }));

export const markAllNotificationsRead = () =>
  simulate(() => {
    db.notifications.all().forEach((n) => db.notifications.patch(n.id, { read: true }));
    return true;
  });
