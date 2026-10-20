import {session} from './store.js';
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
