import {beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../src/backend/http.js';
import {resetMemory} from '../src/backend/memory.js';
import {validateUserProfile} from '../src/shared/validate.js';

beforeEach(() => resetMemory());

function api(method, pathname, {token, body} = {}) {
  return handleApi({method, pathname, headers: token ? {authorization: `Bearer ${token}`} : {}, body});
}

function register() {
  return api('POST', '/api/auth/register', {
    body: {name:'Demo Student', email:'demo@example.com', password:'password123', confirm:'password123'}
  });
}

test('a profile is created with each user and references the account email', () => {
  assert.equal(api('GET', '/api/profile').status, 401);
  const account = register();
  const result = api('GET', '/api/profile', {token:account.body.token});
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.profile, {
    id: account.body.user.id,
    fullName: 'Demo Student',
    email: 'demo@example.com',
    contactInfo: null,
    preferences: {}
  });
});

test('users can update optional contact information and preferences', () => {
  const account = register();
  const result = api('PUT', '/api/profile', {
    token:account.body.token,
    body:{fullName:'  Updated Student  ', contactInfo:'  555-0100  ', preferences:{emailNotifications:true, theme:'dark'}}
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.profile.fullName, 'Updated Student');
  assert.equal(result.body.profile.contactInfo, '555-0100');
  assert.deepEqual(result.body.profile.preferences, {emailNotifications:true, theme:'dark'});
  assert.equal(result.body.profile.email, 'demo@example.com');

  const cleared = api('PUT', '/api/profile', {token:account.body.token, body:{contactInfo:null}});
  assert.equal(cleared.body.profile.contactInfo, null);
});

test('profile updates reject invalid input and cannot change the email reference', () => {
  const account = register();
  const token = account.body.token;
  for (const body of [null, [], {}, {fullName:''}, {contactInfo:42}, {contactInfo:'x'.repeat(201)}, {preferences:[]}, {preferences:null}]) {
    assert.equal(api('PUT', '/api/profile', {token, body}).status, 400, JSON.stringify(body));
  }
  const emailOnly = api('PUT', '/api/profile', {token, body:{email:'other@example.com'}});
  assert.equal(emailOnly.status, 400);
  assert.equal(api('GET', '/api/profile', {token}).body.profile.email, 'demo@example.com');
});

test('profile validation normalizes supported values', () => {
  assert.deepEqual(validateUserProfile({fullName:'  Ada Lovelace ', contactInfo:' ada@example.com '}).values, {
    fullName:'Ada Lovelace', contactInfo:'ada@example.com'
  });
});
