import {state} from '../../shared/state.js';
import {validateService} from '../../shared/validate.js';
import {isAdmin} from '../../data/store.js';
import {ApiError, api, refreshServices} from '../../data/api.js';
import {serviceById} from '../../data/services.js';

export {validateService};

export async function submitService(form, {render, toast}) {
  if (!isAdmin() || !state.serviceForm) return;

  const values = Object.fromEntries(
    ['name', 'description', 'expectedDuration', 'priority'].map(key => [key, form.elements[key].value])
  );
  const result = validateService(values);
  state.serviceForm.values = values;
  state.serviceForm.errors = result.errors;
  if (Object.keys(result.errors).length) {
    render();
    const ids = {name:'service-name', description:'service-description', expectedDuration:'service-duration', priority:'service-priority'};
    document.getElementById(ids[Object.keys(result.errors)[0]]).focus();
    return;
  }

  const editing = state.serviceForm.id !== null;
  try {
    if (editing) {
      await api(`/api/services/${encodeURIComponent(state.serviceForm.id)}`, {method:'PUT', body: result.values});
    } else {
      await api('/api/services', {method:'POST', body: result.values});
    }
    await refreshServices();
    state.serviceForm = null;
    toast(editing ? 'Service updated.' : 'Service created.');
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      toast('This service no longer exists. Cancel and reopen the form.');
      return;
    }
    if (error instanceof ApiError && error.fields) {
      state.serviceForm.errors = error.fields;
      render();
      return;
    }
    toast(error instanceof ApiError ? error.message : 'Could not save the service.');
  }
}

export async function toggleService(id, {render, toast}) {
  if (!isAdmin()) return;
  const service = serviceById(id);
  if (!service) {
    toast('This service no longer exists.');
    return;
  }
  try {
    await api(`/api/services/${encodeURIComponent(id)}`, {method:'PUT', body:{open: !service.open}});
    await refreshServices();
    render();
  } catch (error) {
    toast(error instanceof ApiError ? error.message : 'Could not update the service.');
  }
}
