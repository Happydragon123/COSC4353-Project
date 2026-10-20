export const SERVICES = [];

export const serviceById = id => SERVICES.find(service => service.id === id);

export function replaceServices(list) {
  SERVICES.splice(0, SERVICES.length, ...(list || []).map(service => ({...service})));
}
