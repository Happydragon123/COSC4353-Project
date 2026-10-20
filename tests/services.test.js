import {beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../src/backend/http.js';
import {resetMemory} from '../src/backend/memory.js';
import {validateService, validateServicePatch} from '../src/shared/validate.js';

beforeEach(() => resetMemory());

function api(method, pathname, {token, body} = {}) {
  return handleApi({method, pathname, headers: token ? {authorization: `Bearer ${token}`} : {}, body});
}

function login(email, password) {
  return api('POST', '/api/auth/login', {body: {email, password}}).body.token;
}

function adminToken() {
  return login('admin@queuesmart.local', 'admin1234');
}

function userToken() {
  api('POST', '/api/auth/register', {
    body: {name:'Demo Student', email:'demo@example.com', password:'password123', confirm:'password123'}
  });
  return login('demo@example.com', 'password123');
}

const details = {
  name: 'Career Center',
  description: 'Resume reviews and job search help.',
  expectedDuration: 25,
  priority: 'high'
};

test('authenticated users can list and read seeded services', () => {
  assert.equal(api('GET', '/api/services').status, 401);
  const token = userToken();
  const list = api('GET', '/api/services', {token});
  assert.equal(list.status, 200);
  assert.equal(list.body.services.length, 4);
  assert.ok(list.body.services.every(service => service.name && service.priority));
  const one = api('GET', '/api/services/advising', {token});
  assert.equal(one.status, 200);
  assert.equal(one.body.service.id, 'advising');
  assert.equal(api('GET', '/api/services/missing', {token}).status, 404);
});

test('only administrators can create and update services', () => {
  const user = userToken();
  assert.equal(api('POST', '/api/services', {token: user, body: details}).status, 403);
  assert.equal(api('PUT', '/api/services/advising', {token: user, body: details}).status, 403);

  const admin = adminToken();
  const created = api('POST', '/api/services', {token: admin, body: details});
  assert.equal(created.status, 201);
  assert.equal(created.body.service.open, true);
  assert.equal(created.body.service.wait, 0);
  assert.match(created.body.service.id, /^service-/);

  const updated = api('PUT', `/api/services/${created.body.service.id}`, {
    token: admin,
    body: {name: 'Career Services', open: false, priority: 'low'}
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.service.name, 'Career Services');
  assert.equal(updated.body.service.open, false);
  assert.equal(updated.body.service.priority, 'low');
  assert.equal(updated.body.service.description, details.description);

  assert.equal(api('PUT', '/api/services/missing', {token: admin, body: details}).status, 404);
  assert.equal(api('POST', '/api/services', {token: admin, body: {...details, name: ''}}).status, 400);
  assert.equal(api('PUT', '/api/services/advising', {token: admin, body: {}}).status, 400);
  assert.equal(api('POST', '/api/services', {token: admin, body: null}).status, 400);
});

test('service validation covers required fields, types, and length limits', () => {
  const valid = {name:' Help Desk ', description:' Account support. ', expectedDuration:'15', priority:'medium'};
  assert.deepEqual(validateService(valid).errors, {});
  assert.equal(validateService(valid).values.name, 'Help Desk');
  assert.ok(validateService({...valid, name:''}).errors.name);
  assert.ok(validateService({...valid, name:'x'.repeat(101)}).errors.name);
  assert.ok(validateService({...valid, description:''}).errors.description);
  assert.ok(validateService({...valid, description:'x'.repeat(501)}).errors.description);
  assert.ok(validateService({...valid, expectedDuration:0}).errors.expectedDuration);
  assert.ok(validateService({...valid, priority:'HIGH'}).errors.priority);

  assert.ok(validateServicePatch({}).errors.form);
  assert.ok(validateServicePatch({open:'yes'}).errors.open);
  assert.deepEqual(validateServicePatch({open:true}).values, {open:true});
  assert.ok(validateServicePatch({name:''}).errors.name);
  assert.ok(validateServicePatch({description:'x'.repeat(501)}).errors.description);
  assert.ok(validateServicePatch({expectedDuration:-1}).errors.expectedDuration);
  assert.ok(validateServicePatch({priority:'urgent'}).errors.priority);
});

test('invalid field types are rejected without changing services', () => {
  const token = adminToken();
  const before = api('GET', '/api/services', {token}).body;
  for (const invalid of [
    {name:123}, {name:['Help']}, {description:{text:'Help'}},
    {expectedDuration:true}, {expectedDuration:[15]}, {expectedDuration:null},
    {priority:['high']}, {name:'x'.repeat(101)}, {description:'x'.repeat(501)}
  ]) {
    assert.equal(api('POST', '/api/services', {token, body:{...details, ...invalid}}).status, 400);
    assert.equal(api('PUT', '/api/services/advising', {token, body:invalid}).status, 400);
  }
  assert.deepEqual(api('GET', '/api/services', {token}).body, before);
  assert.equal(api('POST', '/api/services', {body:details}).status, 401);
  assert.equal(api('PUT', '/api/services/advising', {token, body:[]}).status, 400);
});
