import {randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
import {db, databasePath, transaction} from './database.js';
import {queueForService} from './queue-repository.js';
export {queueForService, allQueueEntries, addQueueEntry, removeQueueEntry} from './queue-repository.js';
import {DEMO_ADMIN} from '../shared/demo.js';
import {estimateWaitMinutes} from './wait-time.js';

const DEFAULT_SERVICES = [
  {id:'advising', expectedDuration:20, priority:'medium', name:'Academic Advising', description:'Course planning, degree checks, and academic questions.', icon:'▤', wait:18, length:4, open:true},
  {id:'financial', expectedDuration:30, priority:'high', name:'Financial Aid', description:'Get help with funding, awards, and account questions.', icon:'$', wait:32, length:7, open:true},
  {id:'tech', expectedDuration:15, priority:'medium', name:'IT Help Desk', description:'Account access, devices, software, and campus Wi-Fi.', icon:'⌘', wait:12, length:3, open:true},
  {id:'records', expectedDuration:10, priority:'low', name:'Student Records', description:'Transcripts, enrollment verification, and records.', icon:'▦', wait:0, length:0, open:false}
];

let sessions = new Map();
let notifications = new Map();
let history = new Map();

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex');
  return {salt, hash};
}

export function passwordMatches(password, user) {
  return timingSafeEqual(Buffer.from(hashPassword(password, user.salt).hash, 'hex'), Buffer.from(user.hash, 'hex'));
}

function storedUser(row) {
  if (!row) return null;
  const [, salt, hash] = row.password_hash.split('$');
  return {id: row.user_id, email: row.email, role: row.role, salt, hash,
    name: row.full_name, contactInfo: row.contact_info,
    preferences: JSON.parse(row.preferences ?? '{}')};
}
const userSelect = `SELECT c.*, p.full_name, p.contact_info, p.preferences
  FROM UserCredentials c LEFT JOIN UserProfile p ON p.user_id = c.user_id`;
function storedService(row) {
  return row && {id: row.service_id, name: row.name, description: row.description,
    expectedDuration: row.expected_duration, priority: row.priority, icon: row.icon,
    open: row.status === 'open'};
}
const serviceSelect = `SELECT s.*, q.status FROM Service s JOIN Queue q ON q.service_id = s.service_id`;

export function publicUser(user) {
  return {id: user.id, name: user.name, email: user.email, role: user.role};
}

export function publicUserProfile(user) {
  return {
    id: user.id,
    fullName: user.name,
    email: user.email,
    contactInfo: user.contactInfo ?? null,
    preferences: {...(user.preferences || {})}
  };
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

function seedDefaults() {
  transaction(() => {
    for (const service of DEFAULT_SERVICES) {
      db.prepare(`INSERT INTO Service (service_id, name, description, expected_duration, priority, icon)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(service_id) DO NOTHING`)
        .run(service.id, service.name, service.description, service.expectedDuration, service.priority, service.icon);
      db.prepare(`INSERT INTO Queue (queue_id, service_id, status) VALUES (?, ?, ?)
        ON CONFLICT(service_id) DO NOTHING`).run(`queue-${service.id}`, service.id, service.open ? 'open' : 'closed');
    }
    if (!findUserByEmail(DEMO_ADMIN.email)) {
      insertUser({id: 'user-admin', name: DEMO_ADMIN.name, email: DEMO_ADMIN.email,
        password: DEMO_ADMIN.password, role: 'admin'});
    }
  });
}

// Explicit test reset only; normal startup never deletes database records.
export function resetMemory() {
  if (databasePath !== ':memory:') throw new Error('resetMemory requires an in-memory test database');
  transaction(() => db.exec(`DELETE FROM QueueEntry; DELETE FROM Queue;
    DELETE FROM Service; DELETE FROM UserProfile; DELETE FROM UserCredentials;`));
  sessions = new Map();
  notifications = new Map();
  history = new Map();
  seedDefaults();
}

export function findUserByEmail(email) {
  return storedUser(db.prepare(`${userSelect} WHERE c.email = ?`).get(email));
}

export function findUserById(id) {
  return storedUser(db.prepare(`${userSelect} WHERE c.user_id = ?`).get(id));
}

function insertUser({id, name, email, password, role}) {
  const {salt, hash} = hashPassword(password);
  db.prepare('INSERT INTO UserCredentials (user_id, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(id, email, `scrypt$${salt}$${hash}`, role);
  db.prepare('INSERT INTO UserProfile (user_id, full_name) VALUES (?, ?)').run(id, name);
  return findUserById(id);
}

export function addUser({name, email, password, role = 'user'}) {
  return transaction(() => insertUser({id: `user-${randomBytes(8).toString('hex')}`, name, email, password, role}));
}

export function updateUserProfile(userId, details) {
  const user = findUserById(userId);
  if (!user) return null;
  db.prepare('UPDATE UserProfile SET full_name = ?, contact_info = ?, preferences = ? WHERE user_id = ?')
    .run(details.fullName ?? user.name,
      Object.hasOwn(details, 'contactInfo') ? details.contactInfo : user.contactInfo,
      JSON.stringify(details.preferences ?? user.preferences), userId);
  return findUserById(userId);
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
  return db.prepare(serviceSelect).all().map(storedService).map(publicService);
}

export function findServiceById(id) {
  return storedService(db.prepare(`${serviceSelect} WHERE s.service_id = ?`).get(id));
}

export function addService(details) {
  const id = `service-${randomBytes(8).toString('hex')}`;
  return transaction(() => {
    db.prepare(`INSERT INTO Service (service_id, name, description, expected_duration, priority)
      VALUES (?, ?, ?, ?, ?)`).run(id, details.name, details.description, details.expectedDuration, details.priority);
    db.prepare('INSERT INTO Queue (queue_id, service_id) VALUES (?, ?)').run(`queue-${id}`, id);
    return findServiceById(id);
  });
}

export function updateServiceRecord(id, details) {
  const service = findServiceById(id);
  if (!service) return null;
  const updated = {...service, ...details};
  return transaction(() => {
    db.prepare('UPDATE Service SET name = ?, description = ?, expected_duration = ?, priority = ? WHERE service_id = ?')
      .run(updated.name, updated.description, updated.expectedDuration, updated.priority, id);
    db.prepare('UPDATE Queue SET status = ? WHERE service_id = ?').run(updated.open ? 'open' : 'closed', id);
    return findServiceById(id);
  });
}

seedDefaults();

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
