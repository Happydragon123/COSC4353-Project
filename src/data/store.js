// Mock persistence; replace this module with API calls for A3.
export const KEYS = {accounts:'qs_accounts_v1', session:'qs_session_v1', data:'qs_data_v1'};
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
function seedAdmin(){const list=accounts();if(list.some(a=>a.email===DEMO_ADMIN.email))return;list.push({...DEMO_ADMIN});save(KEYS.accounts,list)}
seedAdmin();
