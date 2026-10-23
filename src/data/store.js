import {DEMO_ADMIN} from '../shared/demo.js';
export {DEMO_ADMIN};

// Only the session token lives in browser storage. API data is a transient cache.
export const KEYS = {session: 'qs_session_v1'};
const load = (key, fallback) => {try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}};
export const session = () => load(KEYS.session, null);
export const isAdmin = () => session()?.role === 'admin';
let data = {queue:null, history:[], notifications:[]};
let queues = {};
export const currentData = () => data;
export const adminQueue = serviceId => queues[serviceId] || [];
export function replaceData(value) { data = value; }
export function replaceAdminQueues(value) { queues = value; }
export function setSession(value){
  clearCachedData();
  localStorage.setItem(KEYS.session,JSON.stringify({...value, role:value.role||'user'}));
}
function clearCachedData(){data={queue:null,history:[],notifications:[]};queues={};}
export function clearSession(){localStorage.removeItem(KEYS.session);clearCachedData();}
