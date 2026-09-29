import {state} from '../../shared/state.js';
import {session} from '../../data/store.js';
import {SERVICES} from '../../data/services.js';
import {escapeHTML} from '../../shared/format.js';


function sidebar(){
  const items=[['admin-dashboard','◫','Dashboard'],['admin-services','⚙','Service Management'],['admin-queue','☷','Queue Management']];
  return `<aside class="sidebar"><div class="brand"><span class="brand-mark">Q</span> Queue<b>Smart</b></div><nav class="nav" aria-label="Admin navigation">${items.map(([id,icon,label])=>`<button data-page="${id}" class="${state.page===id?'active':''}" ${state.page===id?'aria-current="page"':''}><span class="icon" aria-hidden="true">${icon}</span>${label}</button>`).join('')}</nav><div class="sidebar-bottom"><strong>${escapeHTML(session().name)}</strong><small>${escapeHTML(session().email)}</small><button class="logout" id="logout">↪ &nbsp;Log out</button></div></aside>`;
}

function shell(content){
  return `<div class="shell">${sidebar()}<main class="main"><header class="topbar"><span class="topbar-title">QueueSmart / Admin dashboard</span><div class="top-actions"><span class="avatar" title="${escapeHTML(session().name)}">${escapeHTML(session().name.slice(0,1).toUpperCase())}</span></div></header>${content}</main></div>${state.toast?`<div class="toast" role="status">${escapeHTML(state.toast)}</div>`:''}`;
}

export function adminDashboard() {
  const serviceCards = SERVICES.map(service => {
    return `
      <div class="card">
        <h2>${escapeHTML(service.name)}</h2>

        <p>
          Queue length:
          <strong>${service.length}</strong>
        </p>

        <p>
          Status:
          <strong>${service.open ? 'Open' : 'Closed'}</strong>
        </p>

        <button
          class="btn"
          data-action="toggle-service"
          data-service-id="${service.id}"
        >
          ${service.open ? 'Close Queue' : 'Open Queue'}
        </button>
      </div>
    `;
  }).join('');

  return shell(`
    <div class="page">
      <div class="page-header">
        <div>
          <div class="eyebrow">ADMIN PORTAL</div>
          <h1>Dashboard</h1>
          <p class="muted">
            Monitor services and queue activity.
          </p>
        </div>
      </div>

      <div class="grid grid-2">
        ${serviceCards}
      </div>
    </div>
  `);
}

export function serviceManagement() {
  return shell(`<h1>Service Management</h1>`);
}

export function queueManagement() {
  return shell(`<h1>Queue Management</h1>`);
}
