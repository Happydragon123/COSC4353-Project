import {db, transaction} from './database.js';
import {HttpError} from './errors.js';

function entry(row) {
  return row && {id: row.entry_id, serviceId: row.service_id, userId: row.user_id,
    priority: row.priority, joinedAt: row.joined_at, position: row.position,
    sequence: row.sequence, approachingNotified: Boolean(row.approaching_notified)};
}
const select = `SELECT e.*, e.rowid AS sequence, q.service_id FROM QueueEntry e
  JOIN Queue q ON q.queue_id = e.queue_id WHERE e.status = 'waiting'`;

export function queueForService(serviceId) {
  return db.prepare(`${select} AND q.service_id = ? ORDER BY e.position`).all(serviceId).map(entry);
}

export function allQueueEntries() {
  return db.prepare(`${select} ORDER BY q.queue_id, e.position`).all().map(entry);
}

function reorder(queueId) {
  const rows = db.prepare(`SELECT entry_id FROM QueueEntry WHERE queue_id = ? AND status = 'waiting'
    ORDER BY CASE priority WHEN 'high' THEN 2 WHEN 'low' THEN 0 ELSE 1 END DESC, rowid`).all(queueId);
  const offset = db.prepare(`SELECT COALESCE(MAX(position), 0) AS value FROM QueueEntry
    WHERE queue_id = ? AND status = 'waiting'`).get(queueId).value;
  db.prepare(`UPDATE QueueEntry SET position = position + ?
    WHERE queue_id = ? AND status = 'waiting'`).run(offset, queueId);
  const update = db.prepare('UPDATE QueueEntry SET position = ? WHERE entry_id = ?');
  rows.forEach((row, index) => update.run(index + 1, row.entry_id));
}

export function addQueueEntry(record) {
  return transaction(() => {
    const queue = db.prepare('SELECT * FROM Queue WHERE service_id = ?').get(record.serviceId);
    if (!queue || queue.status !== 'open') throw new HttpError(409, 'This queue is currently closed.');
    if (db.prepare("SELECT 1 FROM QueueEntry WHERE user_id = ? AND status = 'waiting'").get(record.userId)) {
      throw new HttpError(409, 'You are already waiting in a queue.');
    }
    const position = db.prepare(`SELECT COALESCE(MAX(position), 0) + 1 AS value
      FROM QueueEntry WHERE queue_id = ? AND status = 'waiting'`).get(queue.queue_id).value;
    db.prepare(`INSERT INTO QueueEntry
      (entry_id, queue_id, user_id, position, joined_at, priority) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(record.id, queue.queue_id, record.userId, position, record.joinedAt, record.priority);
    reorder(queue.queue_id);
    return queueForService(record.serviceId).find(item => item.id === record.id);
  });
}

function finish(row, status) {
  if (!row) return null;
  db.prepare('UPDATE QueueEntry SET status = ? WHERE entry_id = ?').run(status, row.entry_id);
  reorder(row.queue_id);
  return entry(row);
}

export function removeQueueEntry(serviceId, userId, status = 'canceled') {
  return transaction(() => finish(
    db.prepare(`${select} AND q.service_id = ? AND e.user_id = ?`).get(serviceId, userId), status));
}

export function serveNextEntry(serviceId) {
  // Select and finish under the same write lock, including across server processes.
  return transaction(() => finish(db.prepare(`${select} AND q.service_id = ? ORDER BY e.position LIMIT 1`)
    .get(serviceId), 'served'));
}

export function markApproachingNotified(entryId) {
  db.prepare('UPDATE QueueEntry SET approaching_notified = 1 WHERE entry_id = ?').run(entryId);
}
