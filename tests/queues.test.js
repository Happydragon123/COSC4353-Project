import {beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../src/backend/http.js';
import {resetMemory} from '../src/backend/memory.js';

beforeEach(() => resetMemory());

const api = (method, pathname, {token, body} = {}) => handleApi({
  method, pathname, body, headers: token ? {authorization: `Bearer ${token}`} : {}
});
const register = (name, email) => api('POST', '/api/auth/register', {
  body: {name, email, password:'password123', confirm:'password123'}
}).body.token;
const admin = () => api('POST', '/api/auth/login', {
  body: {email:'admin@queuesmart.local', password:'admin1234'}
}).body.token;

test('users can join, inspect, and leave one queue', () => {
  const token = register('First Student', 'first@example.com');
  const joined = api('POST', '/api/queues/advising', {token, body:{}});
  assert.equal(joined.status, 201);
  assert.equal(joined.body.entry.position, 1);
  assert.equal(api('POST', '/api/queues/tech', {token, body:{}}).status, 409);
  assert.equal(api('GET', '/api/queue/me', {token}).body.entry.serviceId, 'advising');
  assert.equal(api('DELETE', '/api/queues/advising', {token}).status, 204);
  assert.equal(api('GET', '/api/queue/me', {token}).body.entry, null);
});

test('admin views and serves priority first, preserving arrival order within priority', () => {
  const first = register('First Student', 'first@example.com');
  const second = register('Priority Student', 'priority@example.com');
  const third = register('Second Priority', 'priority2@example.com');
  api('POST', '/api/queues/advising', {token:first, body:{priority:'normal'}});
  api('POST', '/api/queues/advising', {token:second, body:{priority:'high'}});
  api('POST', '/api/queues/advising', {token:third, body:{priority:'high'}});
  const staff = admin();
  const queue = api('GET', '/api/queues/advising', {token:staff}).body.queue;
  assert.deepEqual(queue.map(entry => entry.name), ['Priority Student', 'Second Priority', 'First Student']);
  assert.deepEqual(queue.map(entry => entry.position), [1, 2, 3]);
  assert.equal(api('POST', '/api/queues/advising/serve', {token:staff}).body.served.name, 'Priority Student');
});

test('queue routes enforce authentication, roles, open queues, and valid inputs', () => {
  const user = register('Demo Student', 'demo@example.com');
  const staff = admin();
  assert.equal(api('POST', '/api/queues/advising', {body:{}}).status, 401);
  assert.equal(api('GET', '/api/queues/advising', {token:user}).status, 403);
  assert.equal(api('POST', '/api/queues/advising', {token:staff, body:{}}).status, 403);
  assert.equal(api('POST', '/api/queues/missing', {token:user, body:{}}).status, 404);
  assert.equal(api('POST', '/api/queues/advising', {token:user, body:{priority:'urgent'}}).status, 400);
  api('PUT', '/api/services/records', {token:staff, body:{open:false}});
  assert.equal(api('POST', '/api/queues/records', {token:user, body:{}}).status, 409);
  assert.equal(api('POST', '/api/queues/advising/serve', {token:staff}).status, 409);
});
