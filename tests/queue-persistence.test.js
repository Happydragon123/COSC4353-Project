import {beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {handleApi} from '../src/backend/http.js';
import {resetMemory} from '../src/backend/memory.js';
import {db, transaction} from '../src/backend/database.js';
import {addQueueEntry, removeQueueEntry} from '../src/backend/queue-repository.js';

beforeEach(() => resetMemory());
const api = (method, pathname, token, body) => handleApi({method, pathname, body,
  headers: token ? {authorization: `Bearer ${token}`} : {}});
const register = (email = 'student@example.com') => api('POST', '/api/auth/register', null,
  {name: 'Student', email, password: 'password123', confirm: 'password123'}).body;

test('queue writes retain completed visits and contiguous priority positions in SQLite', () => {
  const first = register(), second = register('other@example.com');
  const staff = api('POST', '/api/auth/login', null,
    {email: 'admin@queuesmart.local', password: 'admin1234'}).body.token;
  const original = api('POST', '/api/queues/advising', first.token, {priority: 'low'}).body.entry;
  api('POST', '/api/queues/advising', second.token, {priority: 'high'});
  assert.deepEqual(db.prepare("SELECT user_id, position FROM QueueEntry WHERE status = 'waiting' ORDER BY position")
    .all().map(row => [row.user_id, row.position]), [[second.user.id, 1], [first.user.id, 2]]);
  api('POST', '/api/queues/advising/serve', staff);
  assert.equal(db.prepare('SELECT status FROM QueueEntry WHERE user_id = ?').get(second.user.id).status, 'served');
  assert.equal(api('GET', '/api/queue/me', first.token).body.entry.position, 1);
  api('DELETE', '/api/queues/advising', first.token);
  assert.equal(db.prepare('SELECT status FROM QueueEntry WHERE entry_id = ?').get(original.id).status, 'canceled');
  assert.notEqual(api('POST', '/api/queues/advising', first.token).body.entry.id, original.id);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('repository rejects conflicts and rolls back without corrupting positions', () => {
  const user = register();
  const record = {id: 'visit', userId: user.user.id, serviceId: 'advising',
    priority: 'normal', joinedAt: new Date().toISOString()};
  assert.throws(() => addQueueEntry({...record, serviceId: 'missing'}), {status: 409});
  assert.throws(() => addQueueEntry({...record, serviceId: 'records'}), {status: 409});
  assert.throws(() => addQueueEntry({...record, priority: 'urgent'}));
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM QueueEntry').get().count, 0);
  addQueueEntry(record);
  assert.throws(() => addQueueEntry({...record, id: 'duplicate', serviceId: 'tech'}), {status: 409});
  assert.equal(removeQueueEntry('tech', user.user.id), null);
  assert.throws(() => removeQueueEntry('advising', user.user.id, 'invalid'));
  assert.deepEqual({...db.prepare('SELECT position, status FROM QueueEntry').get()}, {position: 1, status: 'waiting'});
  assert.throws(() => transaction(() => {
    db.prepare("UPDATE Queue SET status = 'closed' WHERE service_id = 'advising'").run();
    throw new Error('simulate failed operation');
  }), /simulate failed operation/);
  assert.equal(db.prepare("SELECT status FROM Queue WHERE service_id = 'advising'").get().status, 'open');
});

test('failure during position updates rolls back the inserted visit and all position changes', () => {
  const first = register(), second = register('second@example.com');
  api('POST', '/api/queues/advising', first.token);
  db.exec(`CREATE TEMP TRIGGER reject_reorder BEFORE UPDATE OF position ON QueueEntry
    WHEN NEW.position = 1 BEGIN SELECT RAISE(ABORT, 'simulated reorder failure'); END`);
  try {
    assert.throws(() => addQueueEntry({id: 'failed-visit', userId: second.user.id,
      serviceId: 'advising', priority: 'high', joinedAt: new Date().toISOString()}), /simulated reorder failure/);
    assert.deepEqual(db.prepare('SELECT user_id, position FROM QueueEntry').all().map(row => [row.user_id, row.position]),
      [[first.user.id, 1]]);
  } finally {
    db.exec('DROP TRIGGER reject_reorder');
  }
});

test('API queue state, credentials, services and closed status survive fresh processes', t => {
  const directory = mkdtempSync(join(tmpdir(), 'queuesmart-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const path = join(directory, 'test.db');
  const prelude = `
    import assert from 'node:assert/strict';
    import {handleApi} from './src/backend/http.js';
    import {db} from './src/backend/database.js';
    import {resetMemory} from './src/backend/memory.js';
    const api = (method, pathname, token, body) => handleApi({method, pathname, body,
      headers: token ? {authorization: 'Bearer ' + token} : {}});
    const login = email => api('POST', '/api/auth/login', null, {email, password:'password123'}).body.token;
    const admin = () => api('POST', '/api/auth/login', null,
      {email:'admin@queuesmart.local', password:'admin1234'}).body.token;
  `;
  function process(code) {
    const result = spawnSync(globalThis.process.execPath, ['--input-type=module', '-e', prelude + code],
      {cwd: new URL('..', import.meta.url), encoding: 'utf8',
        env: {...globalThis.process.env, QUEUESMART_DB_PATH: path}});
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    return JSON.parse(result.stdout);
  }
  const original = process(`
    const user = api('POST', '/api/auth/register', null,
      {name:'Persistent User', email:'persist@example.com', password:'password123', confirm:'password123'}).body;
    const staff = admin();
    const service = api('POST', '/api/services', staff,
      {name:'Custom', description:'Persistent service', expectedDuration:12, priority:'medium'}).body.service;
    const joined = api('POST', '/api/queues/' + service.id, user.token, {priority:'high'}).body.entry;
    api('PUT', '/api/services/' + service.id, staff, {open:false});
    console.log(JSON.stringify({joined, service, oldToken:user.token})); db.close();
  `);
  const restored = process(`
    assert.equal(api('GET', '/api/queue/me', ${JSON.stringify(original.oldToken)}).status, 401);
    const token = login('persist@example.com');
    const entry = api('GET', '/api/queue/me', token).body.entry;
    const service = api('GET', '/api/services/' + entry.serviceId, token).body.service;
    assert.equal(service.open, false);
    assert.equal(service.length, 1);
    assert.equal(api('POST', '/api/queues/' + entry.serviceId, token).status, 409);
    const hash = db.prepare("SELECT password_hash FROM UserCredentials WHERE email = 'persist@example.com'").get().password_hash;
    assert.match(hash, /^scrypt\\$/);
    assert.throws(() => resetMemory(), /in-memory/);
    const served = api('POST', '/api/queues/' + entry.serviceId + '/serve', admin()).body.served;
    console.log(JSON.stringify({entry, served})); db.close();
  `);
  assert.deepEqual(restored.entry, original.joined);
  assert.deepEqual(restored.served, original.joined);
  const final = process(`
    const token = login('persist@example.com');
    assert.equal(api('GET', '/api/queue/me', token).body.entry, null);
    const rows = db.prepare('SELECT status, approaching_notified FROM QueueEntry').all();
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    console.log(JSON.stringify(rows)); db.close();
  `);
  assert.deepEqual(final, [{status: 'served', approaching_notified: 1}]);
});
