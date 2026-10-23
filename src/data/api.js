import {session, isAdmin, replaceData, replaceAdminQueues} from './store.js';
import {replaceServices} from './services.js';

export class ApiError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export async function api(pathname, {method = 'GET', body} = {}) {
  const headers = {Accept: 'application/json'};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = session()?.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(pathname, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = null;
  if (response.status !== 204) {
    data = await response.json().catch(() => ({}));
  }
  if (!response.ok) {
    throw new ApiError(response.status, data?.error || 'Request failed', data?.fields);
  }
  return data;
}

export async function refreshServices() {
  const data = await api('/api/services');
  replaceServices(data.services);
  return data.services;
}

export async function refreshAccountData() {
  const token = session()?.token;
  if (!token) return;
  if (isAdmin()) {
    const {services} = await api('/api/services');
    const queues = await Promise.all(services.map(async service => {
      const {queue} = await api(`/api/queues/${encodeURIComponent(service.id)}`);
      return [service.id, queue];
    }));
    if (session()?.token === token) {
      replaceServices(services);
      replaceAdminQueues(Object.fromEntries(queues));
    }
  } else {
    const [services, queue, history, notifications] = await Promise.all([
      api('/api/services'), api('/api/queue/me'), api('/api/history'), api('/api/notifications')
    ]);
    if (session()?.token === token) {
      replaceServices(services.services);
      replaceData({queue:queue.entry, history:history.history, notifications:notifications.notifications});
    }
  }
}
