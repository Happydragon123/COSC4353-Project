import {beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../src/backend/http.js';
import {resetMemory} from '../src/backend/memory.js';

beforeEach(() => resetMemory());
const api = (method, pathname, token, body) => handleApi({
  method, pathname, body, headers: token ? {authorization:`Bearer ${token}`} : {}
});
const register = (name = 'Student') => api('POST', '/api/auth/register', null, {
  name, email:`${name.toLowerCase()}@example.com`, password:'password123', confirm:'password123'
}).body.token;
const admin = () => api('POST', '/api/auth/login', null, {
  email:'admin@queuesmart.local', password:'admin1234'
}).body.token;
const join = (token, priority = 'normal', service = 'advising') =>
  api('POST', `/api/queues/${service}`, token, {priority});
const notes = token => api('GET', '/api/notifications', token).body.notifications;
const history = token => api('GET', '/api/history', token).body.history;
const leave = token => api('DELETE', '/api/queues/advising', token);
const serve = token => api('POST', '/api/queues/advising/serve', token);

test('new accounts have empty notifications and history; reads require authentication', () => {
  const token = register();
  assert.deepEqual(notes(token), []);
  assert.deepEqual(history(token), []);
  for (const [method, path] of [
    ['GET','/api/notifications'], ['POST','/api/notifications/read-all'], ['GET','/api/history']
  ]) {
    assert.equal(api(method, path).status, 401);
    assert.equal(api(method, path, 'invalid').status, 401);
  }
});

test('joining triggers server-generated join and approaching notifications for first positions', () => {
  const first = register('First');
  const result = join(first);
  const items = notes(first);
  assert.deepEqual(items.map(n => n.type), ['approaching', 'joined']);
  assert.match(items[1].text, /Academic Advising.*#1/);
  assert.equal(new Set(items.map(n => n.id)).size, 2);
  for (const note of items) {
    assert.equal(note.entryId, result.body.entry.id);
    assert.equal(note.serviceId, 'advising');
    assert.equal(note.read, false);
    assert.ok(Number.isFinite(Date.parse(note.time)));
  }
  assert.deepEqual(history(first), []);
  api('GET', '/api/queue/me', first);
  api('GET', '/api/notifications', first);
  assert.equal(notes(first).length, 2, 'reading must not trigger duplicate events');
});

test('serving or leaving promotes waiting users and triggers the approaching notification once', () => {
  const first = register('First'), second = register('Second'), third = register('Third'), fourth = register('Fourth');
  for (const token of [first, second, third, fourth]) join(token);
  assert.deepEqual(notes(third).map(n => n.type), ['joined']);
  const staff = admin();
  serve(staff);
  assert.equal(notes(third)[0].type, 'approaching');
  assert.match(notes(third)[0].text, /#2/);
  leave(second);
  assert.equal(notes(third).filter(n => n.type === 'approaching').length, 1);
  assert.equal(notes(fourth)[0].type, 'approaching');
  assert.equal(history(first)[0].outcome, 'Served');
  assert.equal(history(second)[0].outcome, 'Left queue');
});

test('priority displacement never duplicates approaching alerts, and rejoining creates a new visit', () => {
  const low = register('Low'), high = register('High'), other = register('Other');
  join(low, 'low');
  join(high, 'high');
  join(other, 'high');
  assert.equal(api('GET', '/api/queue/me', low).body.entry.position, 3);
  leave(high);
  assert.equal(notes(low).filter(n => n.type === 'approaching').length, 1);
  leave(low);
  join(low, 'low');
  const alerts = notes(low).filter(n => n.type === 'approaching');
  assert.equal(alerts.length, 2);
  assert.notEqual(alerts[0].entryId, alerts[1].entryId);
});

test('mark all read is idempotent, account scoped, and future notifications are unread', () => {
  const first = register('First'), second = register('Second');
  join(first); join(second);
  for (let count = 0; count < 2; count++) {
    const result = api('POST', '/api/notifications/read-all', first);
    assert.equal(result.status, 200);
    assert.ok(result.body.notifications.every(n => n.read));
  }
  assert.ok(notes(second).every(n => !n.read));
  leave(first);
  assert.equal(notes(first)[0].type, 'left');
  assert.equal(notes(first)[0].read, false);
  assert.ok(notes(first).slice(1).every(n => n.read));
});

test('history snapshots completion details and preserves service name after edits', () => {
  const token = register();
  const joined = join(token).body.entry;
  const staff = admin();
  serve(staff);
  const record = history(token)[0];
  assert.deepEqual(record, {
    id:joined.id, serviceId:'advising', serviceName:'Academic Advising',
    joinedAt:joined.joinedAt, priority:'normal', position:1, estimate:0,
    outcome:'Served', finishedAt:record.finishedAt
  });
  assert.ok(Date.parse(record.finishedAt) >= Date.parse(record.joinedAt));
  api('PUT', '/api/services/advising', staff, {name:'Renamed service', expectedDuration:42});
  assert.deepEqual(history(token)[0], record);
  assert.equal(api('GET', '/api/queue/me', token).body.entry, null);
  assert.equal(notes(token)[0].type, 'served');
});

test('history retains multiple visits newest first without exposing other accounts', () => {
  const first = register('First'), second = register('Second');
  const one = join(first).body.entry;
  leave(first);
  const two = join(first, 'high', 'tech').body.entry;
  api('POST', '/api/queues/tech/serve', admin());
  assert.deepEqual(history(first).map(h => h.id), [two.id, one.id]);
  assert.deepEqual(history(first).map(h => h.outcome), ['Served', 'Left queue']);
  assert.deepEqual(history(second), []);
  assert.deepEqual(notes(second), []);
  // Identifiers supplied in an ignored body cannot select another account.
  assert.deepEqual(api('GET','/api/history',second,{userId:one.userId}).body.history, []);
  const leaked = JSON.stringify(history(first));
  assert.doesNotMatch(leaked, /password|email|salt|hash|token/);
});

test('invalid or conflicting operations create no notifications or history', () => {
  const token = register(), staff = admin();
  for (const body of [{priority:'x'.repeat(1000)}, {priority:2}, [], 'bad']) {
    assert.equal(api('POST','/api/queues/advising',token,body).status, 400);
  }
  assert.equal(join(token,'normal','records').status, 409);
  assert.equal(join(token,'normal','missing').status, 404);
  assert.equal(leave(token).status, 404);
  assert.equal(serve(staff).status, 409);
  assert.deepEqual(notes(token), []);
  assert.deepEqual(history(token), []);
  join(token);
  const before = notes(token);
  assert.equal(join(token).status, 409);
  assert.equal(serve(token).status, 403);
  assert.deepEqual(notes(token), before);
  assert.deepEqual(history(token), []);
  serve(staff);
  const completed = history(token);
  const finalNotes = notes(token);
  assert.equal(serve(staff).status, 409);
  assert.equal(leave(token).status, 404);
  assert.deepEqual(history(token), completed);
  assert.deepEqual(notes(token), finalNotes);
});

test('records survive logout and login but reset with server memory', () => {
  let token = register();
  join(token); leave(token);
  api('POST','/api/notifications/read-all',token);
  const before = {notes:notes(token), history:history(token)};
  api('POST','/api/auth/logout',token);
  assert.equal(api('GET','/api/history',token).status, 401);
  token = api('POST','/api/auth/login',null,{email:'student@example.com',password:'password123'}).body.token;
  assert.deepEqual(notes(token), before.notes);
  assert.deepEqual(history(token), before.history);
  resetMemory();
  token = register();
  assert.deepEqual(notes(token), []);
  assert.deepEqual(history(token), []);
});

test('API responses cannot mutate stored history or notification records', () => {
  const token = register();
  join(token); leave(token);
  notes(token)[0].text = 'tampered';
  notes(token)[0].read = true;
  history(token)[0].outcome = 'tampered';
  assert.notEqual(notes(token)[0].text, 'tampered');
  assert.equal(notes(token)[0].read, false);
  assert.equal(history(token)[0].outcome, 'Left queue');
});
