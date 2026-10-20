import {validateAuth} from '../shared/validate.js';
import {HttpError, json} from './errors.js';
import {
  addUser,
  createSession,
  deleteSession,
  findUserByEmail,
  getSession,
  passwordMatches,
  publicUser
} from './memory.js';

function requireBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }
}

function sessionPayload(user, token) {
  return {user: publicUser(user), token};
}

export function registerUser(body) {
  requireBody(body);
  const {values, errors} = validateAuth({...body, register: true});
  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', errors);
  if (findUserByEmail(values.email)) {
    throw new HttpError(409, 'This email is already registered.', {email: 'This email is already registered.'});
  }
  const user = addUser({name: values.name, email: values.email, password: values.password, role: 'user'});
  const session = createSession(user);
  return json(201, sessionPayload(user, session.token));
}

export function loginUser(body) {
  requireBody(body);
  const {values, errors} = validateAuth({...body, register: false});
  if (errors.email || errors.password) {
    const fields = {};
    if (errors.email) fields.email = errors.email;
    if (errors.password) fields.password = errors.password;
    throw new HttpError(400, 'Please correct the highlighted fields.', fields);
  }
  const user = findUserByEmail(values.email);
  if (!user || !passwordMatches(values.password, user)) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  const session = createSession(user);
  return json(200, sessionPayload(user, session.token));
}

export function logoutUser(token) {
  if (!getSession(token)) throw new HttpError(401, 'Sign in to continue.');
  deleteSession(token);
  return {status: 204, body: null};
}

export function currentUser(token) {
  const session = requireAuth(token);
  const user = findUserByEmail(session.email);
  return json(200, {user: publicUser(user)});
}

export function requireAuth(token) {
  const session = getSession(token);
  if (!session) throw new HttpError(401, 'Sign in to continue.');
  return session;
}

export function requireAdmin(token) {
  const session = requireAuth(token);
  if (session.role !== 'admin') throw new HttpError(403, 'Administrator access is required.');
  return session;
}
