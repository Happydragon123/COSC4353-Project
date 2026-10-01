export const state = {
  page: 'dashboard',
  authPage: 'login',
  selected: 'advising',
  adminSelected: 'advising',
  serviceForm: null, // null = closed; {id: null} = create; {id: serviceId} = edit
  modal: null,
  toast: null,
  notificationsOpen: false
};