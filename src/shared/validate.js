const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRIORITIES = ['low', 'medium', 'high'];

export function validateAuth({register, name, email, password, confirm}) {
  const errors = {};
  const values = {
    name: register ? String(name ?? '').trim() : '',
    email: String(email ?? '').trim().toLowerCase(),
    password: String(password ?? ''),
    confirm: register ? String(confirm ?? '') : ''
  };
  if (register && (typeof name !== 'string' || !values.name || values.name.length > 80)) {
    errors.name = 'Enter your name (up to 80 characters).';
  }
  if (typeof email !== 'string' || !values.email || values.email.length > 254 || !EMAIL.test(values.email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (typeof password !== 'string' || !values.password || values.password.length < 8 || values.password.length > 72) {
    errors.password = 'Password must be 8–72 characters.';
  }
  if (register && (typeof confirm !== 'string' || values.confirm !== values.password)) {
    errors.confirm = 'Passwords do not match.';
  }
  return {values, errors};
}

export function validateService(input = {}) {
  const name = String(input.name ?? '').trim();
  const description = String(input.description ?? '').trim();
  const expectedDuration = Number(input.expectedDuration);
  const priority = String(input.priority ?? '');
  const errors = {};

  if (typeof input.name !== 'string' || !name) errors.name = 'Enter a service name.';
  else if (name.length > 100) errors.name = 'Service name must be 100 characters or fewer.';
  if (typeof input.description !== 'string' || !description) errors.description = 'Enter a description.';
  else if (description.length > 500) errors.description = 'Description must be 500 characters or fewer.';
  if (!['string', 'number'].includes(typeof input.expectedDuration) || !Number.isFinite(expectedDuration) || expectedDuration <= 0) {
    errors.expectedDuration = 'Enter a number of minutes greater than zero.';
  }
  if (typeof input.priority !== 'string' || !PRIORITIES.includes(priority)) {
    errors.priority = 'Choose low, medium, or high priority.';
  }

  return {values: {name, description, expectedDuration, priority}, errors};
}

export function validateServicePatch(input = {}) {
  const errors = {};
  const values = {};
  if (Object.prototype.hasOwnProperty.call(input, 'name')) {
    const name = String(input.name ?? '').trim();
    if (typeof input.name !== 'string' || !name) errors.name = 'Enter a service name.';
    else if (name.length > 100) errors.name = 'Service name must be 100 characters or fewer.';
    else values.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'description')) {
    const description = String(input.description ?? '').trim();
    if (typeof input.description !== 'string' || !description) errors.description = 'Enter a description.';
    else if (description.length > 500) errors.description = 'Description must be 500 characters or fewer.';
    else values.description = description;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'expectedDuration')) {
    const expectedDuration = Number(input.expectedDuration);
    if (!['string', 'number'].includes(typeof input.expectedDuration) || !Number.isFinite(expectedDuration) || expectedDuration <= 0) {
      errors.expectedDuration = 'Enter a number of minutes greater than zero.';
    } else values.expectedDuration = expectedDuration;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'priority')) {
    const priority = String(input.priority ?? '');
    if (typeof input.priority !== 'string' || !PRIORITIES.includes(priority)) errors.priority = 'Choose low, medium, or high priority.';
    else values.priority = priority;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'open')) {
    if (typeof input.open !== 'boolean') errors.open = 'Open must be true or false.';
    else values.open = input.open;
  }
  if (!Object.keys(values).length && !Object.keys(errors).length) {
    errors.form = 'Provide at least one field to update.';
  }
  return {values, errors};
}
