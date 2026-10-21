import {randomBytes} from 'node:crypto';
import {requireAdmin, requireAuth} from './auth.js';
import {HttpError, json} from './errors.js';
import {
  addQueueEntry,
  allQueueEntries,
  findServiceById,
  findUserById,
  queueForService,
  removeQueueEntry,
  updateServiceRecord
} from './memory.js';

const PRIORITY = {low: 0, normal: 1, medium: 1, high: 2};

function serviceOrThrow(serviceId) {
  const service = findServiceById(serviceId);
  if (!service) throw new HttpError(404, 'This service no longer exists.');
  return service;
}

function orderedQueue(serviceId) {
  return [...queueForService(serviceId)].sort((a, b) =>
    PRIORITY[b.priority] - PRIORITY[a.priority] || a.sequence - b.sequence
  );
}

function publicEntry(entry, position) {
  const user = findUserById(entry.userId);
  return {
    id: entry.id,
    serviceId: entry.serviceId,
    userId: entry.userId,
    name: user?.name ?? 'Unknown user',
    email: user?.email ?? '',
    priority: entry.priority,
    joinedAt: entry.joinedAt,
    position
  };
}

function syncServiceStats(serviceId) {
  const service = findServiceById(serviceId);
  const length = queueForService(serviceId).length;
  updateServiceRecord(serviceId, {
    length,
    wait: length ? Math.ceil(length * service.expectedDuration) : 0
  });
}

function parsePriority(body) {
  if (body == null) return 'normal';
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }
  const priority = body.priority ?? 'normal';
  if (typeof priority !== 'string' || !(priority in PRIORITY)) {
    throw new HttpError(400, 'Priority must be low, normal, medium, or high.', {
      priority: 'Choose low, normal, medium, or high.'
    });
  }
  return priority;
}

export function joinQueue(token, serviceId, body) {
  const session = requireAuth(token);
  const service = serviceOrThrow(serviceId);
  if (session.role === 'admin') throw new HttpError(403, 'Administrators cannot join a queue.');
  if (!service.open) throw new HttpError(409, 'This queue is currently closed.');
  if (allQueueEntries().some(entry => entry.userId === session.userId)) {
    throw new HttpError(409, 'You are already waiting in a queue.');
  }

  const entry = addQueueEntry({
    id: `queue-${randomBytes(8).toString('hex')}`,
    serviceId,
    userId: session.userId,
    priority: parsePriority(body),
    joinedAt: new Date().toISOString()
  });
  syncServiceStats(serviceId);
  const queue = orderedQueue(serviceId);
  return json(201, {entry: publicEntry(entry, queue.indexOf(entry) + 1)});
}

export function leaveQueue(token, serviceId) {
  const session = requireAuth(token);
  serviceOrThrow(serviceId);
  const entry = removeQueueEntry(serviceId, session.userId);
  if (!entry) throw new HttpError(404, 'You are not waiting in this queue.');
  syncServiceStats(serviceId);
  return {status: 204, body: null};
}

export function getMyQueue(token) {
  const session = requireAuth(token);
  const entry = allQueueEntries().find(item => item.userId === session.userId);
  if (!entry) return json(200, {entry: null});
  const queue = orderedQueue(entry.serviceId);
  return json(200, {entry: publicEntry(entry, queue.indexOf(entry) + 1)});
}

export function viewQueue(token, serviceId) {
  requireAdmin(token);
  serviceOrThrow(serviceId);
  return json(200, {
    queue: orderedQueue(serviceId).map((entry, index) => publicEntry(entry, index + 1))
  });
}

export function serveNext(token, serviceId) {
  requireAdmin(token);
  serviceOrThrow(serviceId);
  const next = orderedQueue(serviceId)[0];
  if (!next) throw new HttpError(409, 'There is no one waiting in this queue.');
  removeQueueEntry(serviceId, next.userId);
  syncServiceStats(serviceId);
  return json(200, {served: publicEntry(next, 1)});
}
