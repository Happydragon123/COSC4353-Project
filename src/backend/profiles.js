import {validateUserProfile} from '../shared/validate.js';
import {requireAuth} from './auth.js';
import {HttpError, json} from './errors.js';
import {findUserById, publicUserProfile, updateUserProfile} from './memory.js';

function requireBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }
}

export function getUserProfile(token) {
  const session = requireAuth(token);
  const user = findUserById(session.userId);
  return json(200, {profile: publicUserProfile(user)});
}

export function editUserProfile(token, body) {
  const session = requireAuth(token);
  requireBody(body);
  const {values, errors} = validateUserProfile(body);
  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', errors);
  const user = updateUserProfile(session.userId, values);
  return json(200, {profile: publicUserProfile(user)});
}
