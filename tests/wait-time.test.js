import {beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {estimateWaitMinutes} from '../src/backend/wait-time.js';
import {handleApi} from '../src/backend/http.js';
import {resetMemory} from '../src/backend/memory.js';

beforeEach(() => resetMemory());

const api = (method, pathname, token, body) => handleApi({
  method, pathname, body,
  headers: token ? {authorization: `Bearer ${token}`} : {}
});
const register = email => api('POST', '/api/auth/register', null, {
  name: 'Test User', email,
  password: 'password123', confirm: 'password123'
}).body.token;
const admin = () => api('POST', '/api/auth/login', null, {
  email: 'admin@queuesmart.local', password: 'admin1234'
}).body.token;
const join = (token, service = 'advising', priority = 'normal') =>
  api('POST', `/api/queues/${service}`, token, {priority});
const mine = token => api('GET', '/api/queue/me', token).body.entry;
const service = (token, id = 'advising') =>
  api('GET', `/api/services/${id}`, token).body.service;

test('wait is based on people ahead and rounded up once', () => {
  assert.equal(estimateWaitMinutes(1, 20), 0);
  assert.equal(estimateWaitMinutes(2, 20), 20);
  assert.equal(estimateWaitMinutes(4, 20), 60);
  assert.equal(estimateWaitMinutes(2, 12.5), 13);
  assert.equal(estimateWaitMinutes(3, 12.5), 25);
});

test('calculator rejects invalid positions and durations', () => {
  for (const value of [undefined, null, '2', true, 0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => estimateWaitMinutes(value, 20), TypeError);
  }
  for (const value of [undefined, null, '20', true, 0, -1, NaN, Infinity]) {
    assert.throws(() => estimateWaitMinutes(1, value), TypeError);
  }
  assert.throws(() => estimateWaitMinutes(3, Number.MAX_VALUE), RangeError);
});

test('empty services report zero wait and zero queue length', () => {
  const token = register('first@example.com');
  const result = api('GET', '/api/services', token);
  assert.equal(result.status, 200);
  for (const item of result.body.services) {
    assert.equal(item.length, 0);
    assert.equal(item.wait, 0);
  }
  assert.equal(mine(token), null);
});

test('join, current-user, and admin responses include position-based estimates', () => {
  const first = register('first@example.com');
  const second = register('second@example.com');
  const staff = admin();
  assert.equal(join(first).body.entry.estimate, 0);
  const result = join(second);
  assert.equal(result.status, 201);
  assert.equal(result.body.entry.position, 2);
  assert.equal(result.body.entry.estimate, 20);
  assert.equal(mine(second).estimate, 20);
  const queue = api('GET', '/api/queues/advising', staff).body.queue;
  assert.deepEqual(queue.map(entry => entry.estimate), [0, 20]);
  assert.equal(service(first).length, 2);
  assert.equal(service(first).wait, 40);
});

test('priority changes estimates while equal priorities preserve arrival order', () => {
  const first = register('first@example.com');
  const second = register('second@example.com');
  const urgent = register('urgent@example.com');
  join(first);
  join(second);
  join(urgent, 'advising', 'high');
  assert.deepEqual(
    [mine(urgent).estimate, mine(first).estimate, mine(second).estimate],
    [0, 20, 40]
  );
});

test('leaving and serving update estimates and eventually clear queue totals', () => {
  const first = register('first@example.com');
  const second = register('second@example.com');
  const third = register('third@example.com');
  const staff = admin();
  join(first); join(second); join(third);
  assert.equal(api('DELETE', '/api/queues/advising', first).status, 204);
  assert.equal(mine(third).estimate, 20);
  const served = api('POST', '/api/queues/advising/serve', staff);
  assert.equal(served.status, 200);
  assert.equal(served.body.served.estimate, 0);
  assert.equal(mine(second), null);
  assert.equal(mine(third).estimate, 0);
  assert.equal(service(third).wait, 20);
  api('POST', '/api/queues/advising/serve', staff);
  assert.equal(service(third).length, 0);
  assert.equal(service(third).wait, 0);
});

test('duration edits immediately update user estimates and service totals', () => {
  const first = register('first@example.com');
  const second = register('second@example.com');
  const staff = admin();
  join(first); join(second);
  const updated = api('PUT', '/api/services/advising', staff, {expectedDuration:12.5});
  assert.equal(updated.status, 200);
  assert.equal(updated.body.service.wait, 25);
  assert.equal(mine(second).estimate, 13);
  assert.equal(service(first).wait, 25);
});

test('queues for different services have independent estimates', () => {
  const first = register('first@example.com');
  const second = register('second@example.com');
  const third = register('third@example.com');
  join(first);
  join(second, 'tech');
  join(third, 'tech');
  assert.equal(mine(first).estimate, 0);
  assert.equal(mine(third).estimate, 15);
  assert.equal(service(first).wait, 20);
  assert.equal(service(first, 'tech').wait, 30);
});

test('invalid priorities cannot enter a queue or affect its estimate', () => {
  const token = register('first@example.com');
  for (const priority of ['urgent', 'toString', 'constructor', '__proto__', 7, []]) {
    assert.equal(join(token, 'advising', priority).status, 400);
  }
  assert.equal(mine(token), null);
  assert.equal(service(token).wait, 0);
});
