import {requireAuth} from './auth.js';
import {json} from './errors.js';
import {addNotification, notificationsForUser, markNotificationsRead} from './memory.js';

export function notifyQueueEvent(entry, type, text) {
  addNotification(entry.userId, {entryId: entry.id, serviceId: entry.serviceId, type, text});
}

// One approaching-turn notification per visit, even if priority joins push the
// visitor back and they later enter the first two positions again.
export function notifyApproaching(queue, service) {
  queue.slice(0, 2).forEach((entry, index) => {
    if (entry.approachingNotified) return;
    notifyQueueEvent(entry, 'approaching',
      `Almost ready! You’re now #${index + 1} in the ${service.name} queue.`);
    entry.approachingNotified = true;
  });
}

export function listNotifications(token) {
  const session = requireAuth(token);
  return json(200, {notifications: notificationsForUser(session.userId)});
}

export function readAllNotifications(token) {
  const session = requireAuth(token);
  markNotificationsRead(session.userId);
  return json(200, {notifications: notificationsForUser(session.userId)});
}
