// Mock persistence; replace this module with API calls for A3.
export const KEYS = {
  accounts: 'qs_accounts_v1',
  session: 'qs_session_v1',
  data: 'qs_data_v1',
  adminQueues: 'qs_admin_queues_v1'
};
export const DEMO_ADMIN = {name:'QueueSmart Staff', email:'admin@queuesmart.local', password:'admin1234', role:'admin'};
const load = (key, fallback) => {try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}};
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
export const accounts = () => load(KEYS.accounts, []);
export const session = () => load(KEYS.session, null);
export const isAdmin = () => session()?.role === 'admin';
const userData = () => load(KEYS.data, {});
export const currentData = () => userData()[session()?.email] || {queue:null, history:[], notifications:[]};
export function updateData(data){const all=userData();all[session().email]=data;save(KEYS.data,all)}
export function registerAccount(account){const list=accounts();list.push({...account, role:account.role||'user'});save(KEYS.accounts,list)}
export function setSession(value){save(KEYS.session,{...value, role:value.role||'user'})}
export function clearSession(){localStorage.removeItem(KEYS.session)}

function minutesAgo(minutes) {
  return new Date(
    Date.now() - minutes * 60000
  ).toISOString();
}

function createAdminQueues() {
  return {

    advising: [
      {
        id: 'adv-1',
        name: 'Mock User 1',
        email: 'mockuser1@example.com',
        joinedAt: minutesAgo(20)
      },
      {
        id: 'adv-2',
        name: 'Mock User 2',
        email: 'mockuser2@example.com',
        joinedAt: minutesAgo(10)
      }
    ],

    financial: [
      {
        id: 'fin-1',
        name: 'Mock User 3',
        email: 'mockuser3@example.com',
        joinedAt: minutesAgo(18)
      },
      {
        id: 'fin-2',
        name: 'Mock User 4',
        email: 'mockuser4@example.com',
        joinedAt: minutesAgo(8)
      }
    ],

    tech: [
      {
        id: 'tech-1',
        name: 'Mock User 5',
        email: 'mockuser5@example.com',
        joinedAt: minutesAgo(14)
      },
      {
        id: 'tech-2',
        name: 'Mock User 6',
        email: 'mockuser6@example.com',
        joinedAt: minutesAgo(6)
      }
    ],

    records: []
  };
}

export const adminQueues = () =>
  load(
    KEYS.adminQueues,
    createAdminQueues()
  );

export const adminQueue = serviceId =>
  adminQueues()[serviceId] || [];


export function updateAdminQueues(queues) {
  save(
    KEYS.adminQueues,
    queues
  );
}

function seedAdmin(){const list=accounts();if(list.some(a=>a.email===DEMO_ADMIN.email))return;list.push({...DEMO_ADMIN});save(KEYS.accounts,list)}
seedAdmin();
