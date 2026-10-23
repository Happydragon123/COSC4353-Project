import {createHash, randomBytes} from 'node:crypto';
import {DEMO_ADMIN} from '../shared/demo.js';
import {estimateWaitMinutes} from './wait-time.js';

const DEFAULT_SERVICES = [
  {id:'advising', expectedDuration:20, priority:'medium', name:'Academic Advising', description:'Course planning, degree checks, and academic questions.', icon:'▤', wait:18, length:4, open:true},
  {id:'financial', expectedDuration:30, priority:'high', name:'Financial Aid', description:'Get help with funding, awards, and account questions.', icon:'$', wait:32, length:7, open:true},
  {id:'tech', expectedDuration:15, priority:'medium', name:'IT Help Desk', description:'Account access, devices, software, and campus Wi-Fi.', icon:'⌘', wait:12, length:3, open:true},
  {id:'records', expectedDuration:10, priority:'low', name:'Student Records', description:'Transcripts, enrollment verification, and records.', icon:'▦', wait:0, length:0, open:false}
];

let users = [];
let sessions = new Map();
let services = [];
let queues = new Map();
let queueSequence = 0;
let notifications = new Map();
let history = new Map();

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = createHash('sha256').update(`${salt}:${password}`).digest('hex');
  return {salt, hash};
}

export function passwordMatches(password, user) {
  return hashPassword(password, user.salt).hash === user.hash;
}

export function publicUser(user) {
  return {id: user.id, name: user.name, email: user.email, role: user.role};
}

export function publicService(service) {
  const length = queueForService(service.id).length;
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    expectedDuration: service.expectedDuration,
    priority: service.priority,
    icon: service.icon,
    wait: estimateWaitMinutes(length + 1, service.expectedDuration),
    length,
    open: service.open
  };
}

export function resetMemory() {
  users = [];
  sessions = new Map();
  services = DEFAULT_SERVICES.map(service => ({...service}));
  queues = new Map(DEFAULT_SERVICES.map(service => [service.id, []]));
  queueSequence = 0;
  notifications = new Map();
  history = new Map();
  const {salt, hash} = hashPassword(DEMO_ADMIN.password);
  users.push({
    id: 'user-admin',
    name: DEMO_ADMIN.name,
    email: DEMO_ADMIN.email,
    role: 'admin',
    salt,
    hash
  });
}

resetMemory();

export function findUserByEmail(email) {
  return users.find(user => user.email === email) || null;
}

export function findUserById(id) {
  return users.find(user => user.id === id) || null;
}

export function addUser({name, email, password, role = 'user'}) {
  const {salt, hash} = hashPassword(password);
  const user = {id: `user-${randomBytes(8).toString('hex')}`, name, email, role, salt, hash};
  users.push(user);
  return user;
}

export function createSession(user) {
  const token = randomBytes(24).toString('hex');
  const session = {token, userId: user.id, name: user.name, email: user.email, role: user.role};
  sessions.set(token, session);
  return session;
}

export function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  const user = findUserById(session.userId);
  return user ? session : null;
}

export function deleteSession(token) {
  return sessions.delete(token);
}

export function listServices() {
  return services.map(publicService);
}

export function findServiceById(id) {
  return services.find(service => service.id === id) || null;
}

export function addService(details) {
  let id;
  do { id = `service-${randomBytes(8).toString('hex')}`; } while (findServiceById(id));
  const service = {id, icon:'▤', wait:0, length:0, open:true, ...details};
  services.push(service);
  queues.set(id, []);
  return service;
}

export function updateServiceRecord(id, details) {
  const service = findServiceById(id);
  if (!service) return null;
  Object.assign(service, details);
  return service;
}

export function queueForService(serviceId) {
  if (!queues.has(serviceId)) queues.set(serviceId, []);
  return queues.get(serviceId);
}

export function allQueueEntries() {
  return [...queues.values()].flat();
}

export function addQueueEntry(entry) {
  const record = {...entry, sequence: queueSequence++};
  queueForService(entry.serviceId).push(record);
  return record;
}

export function removeQueueEntry(serviceId, userId) {
  const queue = queueForService(serviceId);
  const index = queue.findIndex(entry => entry.userId === userId);
  return index < 0 ? null : queue.splice(index, 1)[0];
}

// Account-owned records are never accepted from clients. Return copies so callers
// cannot change stored notifications or completed visit snapshots.
export function addNotification(userId, details) {
  const record = {id: `notification-${randomBytes(8).toString('hex')}`,
    ...details, time: new Date().toISOString(), read: false};
  notifications.set(userId, [record, ...(notifications.get(userId) || [])]);
}

export function notificationsForUser(userId) {
  return (notifications.get(userId) || []).map(record => ({...record}));
}

export function markNotificationsRead(userId) {
  for (const record of notifications.get(userId) || []) record.read = true;
}

export function addHistoryEntry(userId, details) {
  const record = {...details, finishedAt: new Date().toISOString()};
  history.set(userId, [record, ...(history.get(userId) || [])]);
}

export function historyForUser(userId) {
  return (history.get(userId) || []).map(record => ({...record}));
}
