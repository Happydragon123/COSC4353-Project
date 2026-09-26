import {state} from './shared/state.js';
import {escapeHTML} from './shared/format.js';
import {session,currentData,updateData,clearSession} from './data/store.js';
import {authView,submitAuth} from './features/auth/auth.js';
import {dashboard,joinPage,statusPage,historyPage} from './features/user/screens.js';
import {joinQueue,advanceQueue,leaveQueue} from './features/user/queue-actions.js';
const app=document.getElementById('app');
function toast(message){state.toast=message;render();setTimeout(()=>{if(state.toast===message){state.toast=null;render()}},3500)}
function navigate(page){state.page=page;state.notificationsOpen=false;render();window.scrollTo(0,0)}
function render(){if(!session()){app.innerHTML=authView();return}app.innerHTML=({dashboard,join:joinPage,status:statusPage,history:historyPage}[state.page]||dashboard)()}
app.addEventListener('submit',e=>{if(e.target.id==='auth-form'){e.preventDefault();submitAuth(e.target,{render,toast})}});
app.addEventListener('click',e=>{const el=e.target.closest('button');if(!el)return;if(el.dataset.auth){state.authPage=el.dataset.auth;render()}else if(el.dataset.page)navigate(el.dataset.page);else if(el.dataset.select){state.selected=el.dataset.select;render()}else if(el.dataset.quickjoin){state.selected=el.dataset.quickjoin;navigate('join')}else if(el.id==='join-button')joinQueue({navigate,toast});else if(el.id==='advance')advanceQueue({render,navigate,toast});else if(el.id==='leave'){state.modal='leave';render()}else if(el.id==='cancel-leave'){state.modal=null;render()}else if(el.id==='confirm-leave')leaveQueue({navigate,toast});else if(el.id==='bell'||el.id==='view-notifications'){state.notificationsOpen=!state.notificationsOpen;render()}else if(el.id==='mark-read'){const d=currentData();d.notifications.forEach(n=>n.read=true);updateData(d);render()}else if(el.id==='logout'){clearSession();state.authPage='login';state.page='dashboard';render()}});
render();
