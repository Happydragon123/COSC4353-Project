import {api, refreshAccountData} from './data/api.js';
import {state} from './shared/state.js';
import {session,isAdmin,clearSession} from './data/store.js';
import {authView,submitAuth,logoutRemote,restoreSession} from './features/auth/auth.js';
import {dashboard,joinPage,statusPage,historyPage} from './features/user/screens.js';
import {joinQueue,leaveQueue} from './features/user/queue-actions.js';
import {adminDashboard,serviceManagement,queueManagement} from './features/admin/screens.js';
import {serveNextUser} from './features/admin/queue-actions.js';
import {submitService, toggleService} from './features/admin/service-actions.js';

const app=document.getElementById('app');
const userPages={dashboard,join:joinPage,status:statusPage,history:historyPage};
const adminPages = {'admin-dashboard': adminDashboard,'admin-services': serviceManagement,'admin-queue': queueManagement};
function toast(message){state.toast=message;render();setTimeout(()=>{if(state.toast===message){state.toast=null;render()}},3500)}
async function navigate(page){
  state.serviceForm=null;state.page=page;state.notificationsOpen=false;
  await refreshView();window.scrollTo(0,0);
}
async function refreshView(){
  try { await refreshAccountData();render(); }
  catch(error){toast(error.message || 'Could not refresh queue data.');}
}
function render(){
  if(!session()){app.innerHTML=authView();return}
  if(isAdmin()){app.innerHTML=(adminPages[state.page]||adminDashboard)();return}
  app.innerHTML=(userPages[state.page]||dashboard)();
}
function resetClientState(){
  clearSession();
  state.serviceForm=null;
  state.authPage='login';
  state.page='dashboard';
  state.adminSelected='advising';
}
app.addEventListener('submit',e=>{
  if(e.target.id==='service-form'){e.preventDefault();return submitService(e.target,{render,toast})}
  if(e.target.id==='auth-form'){e.preventDefault();return submitAuth(e.target,{render,toast})}
});
app.addEventListener('click',async e=>{
  const el=e.target.closest('button');
  if(!el)return;
  if(el.dataset.auth){state.authPage=el.dataset.auth;render()}
  else if(el.dataset.page)return navigate(el.dataset.page);
  else if(el.dataset.action==='create-service'&&isAdmin()){
    state.serviceForm={id:null};render();document.getElementById('service-name').focus();
  }else if(el.dataset.action==='edit-service'&&isAdmin()){
    state.serviceForm={id:el.dataset.serviceId};render();document.getElementById('service-name').focus();
  }else if(el.dataset.action==='cancel-service-form'&&isAdmin()){
    state.serviceForm=null;render();
  }else if(el.dataset.action==='toggle-service'){toggleService(el.dataset.serviceId,{render,toast})}
  else if(el.dataset.adminService){state.adminSelected=el.dataset.adminService;render()}
  else if(el.dataset.action==='serve-next'){
    try {const served=await serveNextUser(el.dataset.serviceId);toast(`${served.name} was served.`);}
    catch(error){toast(error.message || 'Could not serve the next user.');}
  }
  else if(el.dataset.select){state.selected=el.dataset.select;render()}
  else if(el.dataset.quickjoin){state.selected=el.dataset.quickjoin;return navigate('join')}
  else if(el.id==='join-button')return joinQueue({navigate,toast});
  else if(el.id==='refresh-queue')return refreshView();
  else if(el.id==='leave'){state.modal='leave';render()}
  else if(el.id==='cancel-leave'){state.modal=null;render()}
  else if(el.id==='confirm-leave')return leaveQueue({navigate,toast});
  else if(el.id==='bell'||el.id==='view-notifications'){state.notificationsOpen=!state.notificationsOpen;await refreshView()}
  else if(el.id==='mark-read'){try {await api('/api/notifications/read-all',{method:'POST'});await refreshView();}catch(error){toast(error.message)}}
  else if(el.id==='logout'){return logoutRemote().finally(()=>{resetClientState();render()})}
});

async function boot(){
  const current=session();
  if(current?.token){
    try { await restoreSession(); }
    catch { resetClientState(); }
  } else if(current) {
    resetClientState();
  }
  render();
}
boot();

// Polling lets users see notifications and history after staff serves their turn.
// Avoid replacing an active form or confirmation dialog while the user edits.
let refreshing = false;
window.setInterval?.(async () => {
  if (!session() || state.serviceForm || state.modal || refreshing) return;
  refreshing = true;
  try { await refreshView(); } finally { refreshing = false; }
}, 5000);
