import {currentUser, loginUser, logoutUser, registerUser} from './auth.js';
import {HttpError, json} from './errors.js';
import {createService, getService, listServicesForUser, updateService} from './services.js';
import {getMyQueue, joinQueue, leaveQueue, serveNext, viewQueue} from './queues.js';

function bearerToken(headers = {}) {
  const header = headers.authorization || headers.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export function handleApi({method, pathname, headers = {}, body = null}) {
  try {
    const token = bearerToken(headers);
    if (method === 'POST' && pathname === '/api/auth/register') return registerUser(body);
    if (method === 'POST' && pathname === '/api/auth/login') return loginUser(body);
    if (method === 'POST' && pathname === '/api/auth/logout') return logoutUser(token);
    if (method === 'GET' && pathname === '/api/auth/me') return currentUser(token);
    if (method === 'GET' && pathname === '/api/services') return listServicesForUser(token);
    if (method === 'POST' && pathname === '/api/services') return createService(token, body);
    const serviceMatch = pathname.match(/^\/api\/services\/([^/]+)$/);
    if (serviceMatch && method === 'GET') return getService(token, decodeURIComponent(serviceMatch[1]));
    if (serviceMatch && method === 'PUT') return updateService(token, decodeURIComponent(serviceMatch[1]), body);
    if (method === 'GET' && pathname === '/api/queue/me') return getMyQueue(token);
    const queueMatch = pathname.match(/^\/api\/queues\/([^/]+)$/);
    if (queueMatch && method === 'GET') return viewQueue(token, decodeURIComponent(queueMatch[1]));
    if (queueMatch && method === 'POST') return joinQueue(token, decodeURIComponent(queueMatch[1]), body);
    if (queueMatch && method === 'DELETE') return leaveQueue(token, decodeURIComponent(queueMatch[1]));
    const serveMatch = pathname.match(/^\/api\/queues\/([^/]+)\/serve$/);
    if (serveMatch && method === 'POST') return serveNext(token, decodeURIComponent(serveMatch[1]));
    return json(404, {error: 'Not found'});
  } catch (error) {
    if (error instanceof HttpError) {
      return json(error.status, {error: error.message, ...(error.fields ? {fields: error.fields} : {})});
    }
    throw error;
  }
}
