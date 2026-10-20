import {validateService, validateServicePatch} from '../shared/validate.js';
import {HttpError, json} from './errors.js';
import {requireAdmin, requireAuth} from './auth.js';
import {addService, findServiceById, listServices, publicService, updateServiceRecord} from './memory.js';

function requireBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }
}

export function listServicesForUser(token) {
  requireAuth(token);
  return json(200, {services: listServices()});
}

export function createService(token, body) {
  requireAdmin(token);
  requireBody(body);
  const {values, errors} = validateService(body);
  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', errors);
  const service = addService(values);
  return json(201, {service: publicService(service)});
}

export function updateService(token, id, body) {
  requireAdmin(token);
  requireBody(body);
  if (!findServiceById(id)) throw new HttpError(404, 'This service no longer exists.');
  const {values, errors} = validateServicePatch(body);
  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', errors);
  const service = updateServiceRecord(id, values);
  return json(200, {service: publicService(service)});
}

export function getService(token, id) {
  requireAuth(token);
  const service = findServiceById(id);
  if (!service) throw new HttpError(404, 'This service no longer exists.');
  return json(200, {service: publicService(service)});
}
