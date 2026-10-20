import {beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../src/backend/http.js';
import {resetMemory} from '../src/backend/memory.js';

beforeEach(() => resetMemory());

function api(method, pathname, {token, body, headers} = {}) {
  return handleApi({
    method,
    pathname,
    headers: {
      ...(token ? {authorization: `Bearer ${token}`} : {}),
      ...headers
    },
    body
  });
}

function register(overrides = {}) {
  return api('POST', '/api/auth/register', {
    body: {name:'Demo Student', email:'demo@example.com', password:'password123', confirm:'password123', ...overrides}
  });
}

test('register creates a user session and rejects duplicates and invalid input', () => {
  const created = register();
  assert.equal(created.status, 201);
  assert.equal(created.body.user.role, 'user');
  assert.equal(created.body.user.email, 'demo@example.com');
  assert.ok(created.body.token);
  assert.equal(register().status, 409);
  assert.equal(register({email:'x'}).status, 400);
  assert.equal(register({password:'short', confirm:'short'}).status, 400);
  assert.equal(register({name:'', email:'ok@example.com'}).status, 400);
  assert.equal(register({confirm:'different'}).status, 400);
  assert.equal(register({email:'other@example.com', role:'admin'}).body.user.role, 'user');
  assert.equal(api('POST', '/api/auth/register', {body:null}).status, 400);
  assert.equal(api('POST', '/api/auth/register', {body:[]}).status, 400);
});

test('login validates input, authenticates the seeded admin, and rejects bad passwords', () => {
  assert.equal(api('POST', '/api/auth/login', {body:{email:'bad', password:'password123'}}).status, 400);
  assert.equal(api('POST', '/api/auth/login', {body:{email:'admin@queuesmart.local', password:'nope1234'}}).status, 401);
  const login = api('POST', '/api/auth/login', {body:{email:'admin@queuesmart.local', password:'admin1234'}});
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'admin');
  assert.ok(login.body.token);
});

test('me and logout require a live session token', () => {
  assert.equal(api('GET', '/api/auth/me').status, 401);
  const login = api('POST', '/api/auth/login', {body:{email:'admin@queuesmart.local', password:'admin1234'}});
  const me = api('GET', '/api/auth/me', {token: login.body.token});
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'admin@queuesmart.local');
  const logout = api('POST', '/api/auth/logout', {token: login.body.token});
  assert.equal(logout.status, 204);
  assert.equal(logout.body, null);
  assert.equal(api('GET', '/api/auth/me', {token: login.body.token}).status, 401);
  assert.equal(api('POST', '/api/auth/logout', {token: login.body.token}).status, 401);
});

test('unknown API routes return 404', () => {
  const result = api('GET', '/api/missing');
  assert.equal(result.status, 404);
  assert.equal(result.body.error, 'Not found');
});

test('registration cannot bypass validation or choose an administrator role', () => {
  const invalid = register({register:false, name:'', role:'admin'});
  assert.equal(invalid.status, 400);
  assert.ok(invalid.body.fields.name);
  const created = register({email:'  STUDENT@example.com  ', role:'admin'});
  assert.equal(created.body.user.email, 'student@example.com');
  assert.equal(created.body.user.role, 'user');
  assert.equal(register({email:'STUDENT@example.com'}).status, 409);
  assert.deepEqual(Object.keys(created.body.user).sort(), ['email', 'id', 'name', 'role']);
});

test('authentication rejects incorrect types and excessive field lengths', () => {
  for (const invalid of [
    {name:123}, {name:'x'.repeat(81)}, {email:['demo@example.com']},
    {email:'x'.repeat(255)}, {password:12345678, confirm:12345678},
    {password:'x'.repeat(73), confirm:'x'.repeat(73)}, {confirm:['password123']}
  ]) assert.equal(register(invalid).status, 400, JSON.stringify(invalid));
  assert.equal(api('POST', '/api/auth/login', {body:{email:'missing@example.com', password:'password123'}}).status, 401);
  const created = register();
  const login = api('POST', '/api/auth/login', {body:{email:'DEMO@example.com', password:'password123'}});
  assert.equal(login.status, 200);
  assert.equal(login.body.user.id, created.body.user.id);
});
