import {requireAuth} from './auth.js';
import {json} from './errors.js';
import {addHistoryEntry, historyForUser} from './memory.js';

export function recordVisit(entry, service, outcome) {
  addHistoryEntry(entry.userId, {
    id: entry.id, serviceId: entry.serviceId, serviceName: service.name,
    priority: entry.priority, joinedAt: entry.joinedAt,
    position: entry.position, estimate: entry.estimate, outcome
  });
}

export function listHistory(token) {
  const session = requireAuth(token);
  return json(200, {history: historyForUser(session.userId)});
}
