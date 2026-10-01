import {state} from '../../shared/state.js';
import {isAdmin, saveService} from '../../data/store.js';

export function validateService(values) {
  const name = values.name.trim();
  const description = values.description.trim();
  const expectedDuration = Number(values.expectedDuration);
  const priority = values.priority;
  const errors = {};

  if (!name) errors.name = 'Enter a service name.';
  else if (name.length > 100) errors.name = 'Service name must be 100 characters or fewer.';
  if (!description) errors.description = 'Enter a description.';
  if (!Number.isFinite(expectedDuration) || expectedDuration <= 0) {
    errors.expectedDuration = 'Enter a number of minutes greater than zero.';
  }
  if (!['low', 'medium', 'high'].includes(priority)) {
    errors.priority = 'Choose low, medium, or high priority.';
  }

  return {values: {name, description, expectedDuration, priority}, errors};
}

export function submitService(form, {render, toast}) {
  if (!isAdmin() || !state.serviceForm) return;

  // Keep the original input strings separate from the trimmed values we save.
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
  const saved = saveService(state.serviceForm.id, result.values);
  if (!saved) {
    toast('This service no longer exists. Cancel and reopen the form.');
    return;
  }
  state.serviceForm = null;
  toast(editing ? 'Service updated.' : 'Service created.');
}
