import {api, refreshAccountData} from '../../data/api.js';

export async function serveNextUser(serviceId) {
  const {served} = await api(`/api/queues/${encodeURIComponent(serviceId)}/serve`, {method:'POST'});
  await refreshAccountData();
  return served;
}
