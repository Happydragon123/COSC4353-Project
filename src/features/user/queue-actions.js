import {state} from '../../shared/state.js';
import {currentData} from '../../data/store.js';
import {ApiError, api, refreshAccountData} from '../../data/api.js';

export async function joinQueue({navigate,toast}) {
  try {
    await api(`/api/queues/${encodeURIComponent(state.selected)}`, {method:'POST', body:{}});
    await refreshAccountData();
    await navigate('status');
    toast('You’ve joined the queue.');
  } catch (error) {
    toast(error instanceof ApiError ? error.message : 'Could not join the queue. Try again.');
  }
}

export async function leaveQueue({navigate,toast}) {
  const queue = currentData().queue;
  if (!queue) return;
  try {
    await api(`/api/queues/${encodeURIComponent(queue.serviceId)}`, {method:'DELETE'});
    await refreshAccountData();
    state.modal = null;
    await navigate('history');
    toast('You’ve left the queue.');
  } catch (error) {
    toast(error instanceof ApiError ? error.message : 'Could not leave the queue. Try again.');
  }
}
