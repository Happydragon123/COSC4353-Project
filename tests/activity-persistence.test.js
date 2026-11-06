import {beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {handleApi} from '../src/backend/http.js';
import {resetMemory} from '../src/backend/memory.js';
import {db, transaction} from '../src/backend/database.js';

beforeEach(() => resetMemory());
const api = (method, pathname, token, body) => handleApi({method, pathname, body,
  headers: token ? {authorization: `Bearer ${token}`} : {}});
const register = (email = 'student@example.com') => api('POST', '/api/auth/register', null,
  {name: 'Student', email, password: 'password123', confirm: 'password123'}).body;
const admin = () => api('POST', '/api/auth/login', null,
  {email: 'admin@queuesmart.local', password: 'admin1234'}).body.token;
const notes = token => api('GET', '/api/notifications', token).body.notifications;
const history = token => api('GET', '/api/history', token).body.history;
const joinQueue = token => api('POST', '/api/queues/advising', token);
const leave = token => api('DELETE', '/api/queues/advising', token);
const serve = token => api('POST', '/api/queues/advising/serve', token);

function processAt(path, code) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
    env: {...process.env, QUEUESMART_DB_PATH: path}
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
}

function temporaryDatabase(t) {
  const directory = mkdtempSync(join(tmpdir(), 'queuesmart-activity-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  return join(directory, 'test.db');
}

test('notification schema validates content, timestamp, type, owner, and unique event', () => {
  const user = register();
  const entry = joinQueue(user.token).body.entry;
  const insert = changes => {
    const row = {id: 'schema-note', user: user.user.id, entry: entry.id,
      type: 'left', message: 'Message', time: new Date().toISOString(), status: 'sent', ...changes};
    return db.prepare(`INSERT INTO Notification
      (notification_id, user_id, entry_id, type, message, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(row.id, row.user, row.entry,
      row.type, row.message, row.time, row.status);
  };
  for (const invalid of [
    {id: ''}, {id: 'x'.repeat(101)}, {id: ' spaced '},
    {message: null}, {message: ''}, {message: '   '}, {message: 'x'.repeat(1001)},
    {message: []}, {type: 'invalid'}, {status: 'read'}, {time: null},
    {time: '2026-02-30T00:00:00.000Z'}, {time: 'invalid'},
    {entry: 'missing'}, {user: 'user-admin'}, {user: 'missing'}
  ]) assert.throws(() => insert(invalid), undefined, JSON.stringify(invalid));
  insert({});
  assert.throws(() => insert({id: 'duplicate-event'}), /UNIQUE/);
  const result = notes(user.token)[0];
  assert.equal(result.id, 'schema-note');
  assert.equal(result.read, false);
  api('POST', '/api/notifications/read-all', user.token);
  assert.equal(db.prepare('SELECT status FROM Notification WHERE notification_id = ?')
    .get(result.id).status, 'viewed');
  assert.equal(notes(user.token)[0].read, true);
});

test('history schema rejects invalid snapshots, wrong owners, and outcome/status mismatches', () => {
  const user = register();
  const entry = joinQueue(user.token).body.entry;
  leave(user.token);
  const original = {...db.prepare('SELECT * FROM VisitHistory WHERE entry_id = ?').get(entry.id)};
  db.prepare('DELETE FROM VisitHistory WHERE entry_id = ?').run(entry.id);
  const insert = changes => {
    const row = {...original, ...changes};
    return db.prepare(`INSERT INTO VisitHistory
      (entry_id, user_id, service_name, position, estimate, outcome, finished_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(row.entry_id, row.user_id, row.service_name,
      row.position, row.estimate, row.outcome, row.finished_at);
  };
  for (const invalid of [
    {service_name: null}, {service_name: ''}, {service_name: '   '}, {service_name: 'x'.repeat(101)},
    {position: 0}, {position: 1.5}, {estimate: -1}, {estimate: null}, {estimate: 'bad'},
    {finished_at: 'bad'}, {finished_at: '2026-02-30T00:00:00.000Z'}, {finished_at: null},
    {outcome: 'invalid'}, {outcome: 'Served'}, {user_id: 'user-admin'}, {entry_id: 'missing'}
  ]) assert.throws(() => insert(invalid), undefined, JSON.stringify(invalid));
  insert({});
  assert.throws(() => insert({}), /UNIQUE/);
  assert.throws(() => db.prepare("UPDATE VisitHistory SET outcome = 'Served' WHERE entry_id = ?")
    .run(entry.id), /completed queue entry/);
  assert.equal(history(user.token)[0].outcome, 'Left queue');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('a failed join notification rolls back the entry and notification flag', () => {
  const user = register();
  db.exec(`CREATE TEMP TRIGGER reject_join_note BEFORE INSERT ON Notification
    BEGIN SELECT RAISE(ABORT, 'simulated notification failure'); END`);
  try {
    assert.throws(() => joinQueue(user.token), /simulated notification failure/);
    assert.equal(api('GET', '/api/queue/me', user.token).body.entry, null);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM QueueEntry').get().n, 0);
    assert.deepEqual(notes(user.token), []);
  } finally {
    db.exec('DROP TRIGGER reject_join_note');
  }
});

for (const operation of ['serve', 'leave']) {
  for (const table of ['Notification', 'VisitHistory']) {
    test(`${operation} rolls back queue state and activity when ${table} insertion fails`, () => {
      const user = register();
      joinQueue(user.token);
      const entry = api('GET', '/api/queue/me', user.token).body.entry;
      const before = notes(user.token);
      const staff = admin();
      db.exec(`CREATE TEMP TRIGGER reject_activity BEFORE INSERT ON ${table}
        BEGIN SELECT RAISE(ABORT, 'simulated activity failure'); END`);
      try {
        assert.throws(() => operation === 'serve' ? serve(staff) : leave(user.token),
          /simulated activity failure/);
        assert.deepEqual(api('GET', '/api/queue/me', user.token).body.entry, entry);
        assert.deepEqual(notes(user.token), before);
        assert.deepEqual(history(user.token), []);
        assert.equal(db.prepare('SELECT status FROM QueueEntry WHERE entry_id = ?')
          .get(entry.id).status, 'waiting');
      } finally {
        db.exec('DROP TRIGGER reject_activity');
      }
    });
  }
}

test('failed approaching notification rolls back service completion and all promotions', () => {
  const users = ['first', 'second', 'third'].map(name => register(`${name}@example.com`));
  users.forEach(user => joinQueue(user.token));
  const beforeEntries = db.prepare('SELECT * FROM QueueEntry ORDER BY rowid').all();
  const beforeNotes = users.map(user => notes(user.token));
  db.exec(`CREATE TEMP TRIGGER reject_promotion BEFORE INSERT ON Notification
    WHEN NEW.type = 'approaching'
    BEGIN SELECT RAISE(ABORT, 'simulated approaching failure'); END`);
  try {
    assert.throws(() => serve(admin()), /simulated approaching failure/);
    assert.deepEqual(db.prepare('SELECT * FROM QueueEntry ORDER BY rowid').all(), beforeEntries);
    assert.deepEqual(users.map(user => notes(user.token)), beforeNotes);
    assert.deepEqual(history(users[0].token), []);
  } finally {
    db.exec('DROP TRIGGER reject_promotion');
  }
});

test('a nested transaction can fail without keeping its writes or losing outer writes', () => {
  const original = db.prepare("SELECT description FROM Service WHERE service_id = 'advising'").get();
  transaction(() => {
    db.prepare("UPDATE Queue SET status = 'closed' WHERE service_id = 'advising'").run();
    assert.throws(() => transaction(() => {
      db.prepare("UPDATE Service SET description = 'temporary' WHERE service_id = 'advising'").run();
      throw new Error('nested failure');
    }), /nested failure/);
    assert.deepEqual(db.prepare("SELECT description FROM Service WHERE service_id = 'advising'").get(), original);
  });
  assert.equal(db.prepare("SELECT status FROM Queue WHERE service_id = 'advising'").get().status, 'closed');
  assert.equal(db.isTransaction, false);
});

test('notifications, read status, history snapshots and profile edits survive fresh processes', t => {
  const path = temporaryDatabase(t);
  const prelude = `
    import assert from 'node:assert/strict';
    import {handleApi} from './src/backend/http.js';
    import {db} from './src/backend/database.js';
    const api = (method, pathname, token, body) => handleApi({method, pathname, body,
      headers: token ? {authorization: 'Bearer ' + token} : {}});
    const login = () => api('POST', '/api/auth/login', null,
      {email:'persist@example.com', password:'password123'}).body.token;
    const notes = token => api('GET', '/api/notifications', token).body.notifications;
    const history = token => api('GET', '/api/history', token).body.history;
  `;
  const original = processAt(path, prelude + `
    const user = api('POST', '/api/auth/register', null,
      {name:'Persistent', email:'persist@example.com', password:'password123', confirm:'password123'}).body;
    const other = api('POST', '/api/auth/register', null,
      {name:'Other', email:'other@example.com', password:'password123', confirm:'password123'}).body;
    api('PUT', '/api/profile', user.token,
      {fullName:'Saved Name', contactInfo:'555-0100', preferences:{theme:'dark'}});
    api('POST', '/api/queues/advising', user.token);
    api('DELETE', '/api/queues/advising', user.token);
    api('POST', '/api/notifications/read-all', user.token);
    const staff = api('POST', '/api/auth/login', null,
      {email:'admin@queuesmart.local', password:'admin1234'}).body.token;
    api('PUT', '/api/services/advising', staff, {name:'Renamed service'});
    console.log(JSON.stringify({notes:notes(user.token), history:history(user.token), oldToken:user.token}));
    db.close();
  `);
  const restored = processAt(path, prelude + `
    assert.equal(api('GET', '/api/notifications', ${JSON.stringify(original.oldToken)}).status, 401);
    const token = login();
    const profile = api('GET', '/api/profile', token).body.profile;
    assert.equal(profile.fullName, 'Saved Name');
    assert.equal(profile.contactInfo, '555-0100');
    assert.deepEqual(profile.preferences, {theme:'dark'});
    const before = {notes:notes(token), history:history(token)};
    assert.ok(before.notes.every(note => note.read));
    assert.equal(before.history[0].serviceName, 'Academic Advising');
    const other = api('POST', '/api/auth/login', null,
      {email:'other@example.com', password:'password123'}).body.token;
    assert.deepEqual(notes(other), []);
    assert.deepEqual(history(other), []);
    api('POST', '/api/queues/advising', token);
    const after = notes(token);
    assert.deepEqual(after.slice(2), before.notes);
    assert.ok(after.slice(0, 2).every(note => !note.read));
    console.log(JSON.stringify({before, after})); db.close();
  `);
  assert.deepEqual(restored.before, {notes: original.notes, history: original.history});
  const final = processAt(path, prelude + `
    const token = login();
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    console.log(JSON.stringify({notes:notes(token), history:history(token)})); db.close();
  `);
  assert.deepEqual(final, {notes: restored.after, history: original.history});
});

test('upgrade recovers legacy completed visits, preserves waiting entries, and runs only once', t => {
  const path = temporaryDatabase(t);
  processAt(path, `
    import {DatabaseSync} from 'node:sqlite';
    import {readFileSync} from 'node:fs';
    const db = new DatabaseSync(process.env.QUEUESMART_DB_PATH);
    for (const name of ['001_user_credentials.sql', '003_queue_dependencies.sql',
      '004_queue.sql', '005_queue_entry.sql', '006_queue_runtime.sql']) {
      db.exec(readFileSync('database/' + name, 'utf8'));
    }
    db.prepare('INSERT INTO UserCredentials VALUES (?, ?, ?, ?)')
      .run('legacy-user', 'legacy@example.com', 'scrypt$' + 'a'.repeat(32) + '$' + 'b'.repeat(128), 'user');
    db.exec("INSERT INTO UserProfile(user_id, full_name) VALUES ('legacy-user', 'Legacy')");
    db.exec("INSERT INTO Service(service_id, name, description, expected_duration, priority) VALUES ('legacy', 'Legacy Service', 'Old', 10, 'medium')");
    db.exec("INSERT INTO Queue(queue_id, service_id) VALUES ('legacy-q', 'legacy')");
    const insert = db.prepare('INSERT INTO QueueEntry(entry_id, queue_id, user_id, position, status) VALUES (?, ?, ?, ?, ?)');
    insert.run('old-served', 'legacy-q', 'legacy-user', 1, 'served');
    insert.run('old-canceled', 'legacy-q', 'legacy-user', 2, 'canceled');
    insert.run('still-waiting', 'legacy-q', 'legacy-user', 1, 'waiting');
    console.log(JSON.stringify(true)); db.close();
  `);
  const code = `
    import assert from 'node:assert/strict';
    import './src/backend/memory.js';
    import {historyForUser, notificationsForUser} from './src/backend/activity-repository.js';
    import {db} from './src/backend/database.js';
    assert.equal(db.prepare("SELECT status FROM QueueEntry WHERE entry_id = 'still-waiting'").get().status, 'waiting');
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM schema_migrations WHERE name = '007_notification_history.sql'").get().n, 1);
    assert.deepEqual(notificationsForUser('legacy-user'), []);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    console.log(JSON.stringify(historyForUser('legacy-user'))); db.close();
  `;
  const recovered = processAt(path, code);
  assert.equal(recovered.length, 2);
  assert.deepEqual(new Set(recovered.map(item => item.outcome)), new Set(['Served', 'Left queue']));
  assert.ok(recovered.every(item => item.finishedAt === null && item.estimate === null && item.serviceName === 'Legacy Service'));
  assert.deepEqual(processAt(path, code), recovered);
});

test('rerunning the activity schema preserves saved messages and completion snapshots', () => {
  const user = register();
  joinQueue(user.token); leave(user.token);
  const before = {notes: notes(user.token), history: history(user.token)};
  db.exec(readFileSync(new URL('../database/007_notification_history.sql', import.meta.url), 'utf8'));
  assert.deepEqual({notes: notes(user.token), history: history(user.token)}, before);
});
