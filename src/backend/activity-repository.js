import {randomBytes} from 'node:crypto';
import {db} from './database.js';

export function addNotification(userId, details) {
  db.prepare(`INSERT INTO Notification
    (notification_id, user_id, entry_id, type, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(`notification-${randomBytes(8).toString('hex')}`, userId,
      details.entryId, details.type, details.text, new Date().toISOString());
}

export function notificationsForUser(userId) {
  return db.prepare(`SELECT n.*, q.service_id FROM Notification n
    JOIN QueueEntry e ON e.entry_id = n.entry_id
    JOIN Queue q ON q.queue_id = e.queue_id
    WHERE n.user_id = ? ORDER BY n.rowid DESC`).all(userId).map(row => ({
    id: row.notification_id, entryId: row.entry_id, serviceId: row.service_id,
    type: row.type, text: row.message, time: row.created_at, read: row.status === 'viewed'
  }));
}

export function markNotificationsRead(userId) {
  db.prepare("UPDATE Notification SET status = 'viewed' WHERE user_id = ? AND status = 'sent'").run(userId);
}

export function addHistoryEntry(userId, details) {
  db.prepare(`INSERT INTO VisitHistory
    (entry_id, user_id, service_name, position, estimate, outcome, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(details.id, userId, details.serviceName, details.position,
      details.estimate, details.outcome, new Date().toISOString());
}

export function historyForUser(userId) {
  return db.prepare(`SELECT h.*, e.joined_at, e.priority, q.service_id FROM VisitHistory h
    JOIN QueueEntry e ON e.entry_id = h.entry_id
    JOIN Queue q ON q.queue_id = e.queue_id
    WHERE h.user_id = ? ORDER BY COALESCE(h.finished_at, e.joined_at) DESC, h.rowid DESC`)
    .all(userId).map(row => ({
      id: row.entry_id, serviceId: row.service_id, serviceName: row.service_name,
      priority: row.priority, joinedAt: row.joined_at, position: row.position,
      estimate: row.estimate, outcome: row.outcome, finishedAt: row.finished_at
    }));
}
