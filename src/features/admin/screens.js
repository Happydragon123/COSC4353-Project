import {state} from '../../shared/state.js';
import {session, adminQueue} from '../../data/store.js';
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
          <strong>${adminQueue(service.id).length}</strong>
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
  const selectedService =
    SERVICES.find(
      service =>
        service.id === state.adminSelected
    ) || SERVICES[0];

  const queue =
    adminQueue(selectedService.id);

  const serviceButtons =
    SERVICES.map(service => {

      const length =
        adminQueue(service.id).length;

      const selected =
        service.id === selectedService.id;

      return `
        <button
          class="admin-service-tab ${selected ? 'selected' : ''}"
          data-admin-service="${service.id}"
          aria-pressed="${selected}"
        >
          <span>
            ${escapeHTML(service.name)}
          </span>

          <small>
            ${length} waiting
          </small>
        </button>
      `;
    }).join('');

  const queueRows =
    queue.map((user, index) => {

      return `
        <tr>
          <td>
            <strong>
              #${index + 1}
            </strong>
          </td>

          <td>
            <div class="queue-person">
              <strong>
                ${escapeHTML(user.name)}
              </strong>

              <small>
                ${escapeHTML(user.email)}
              </small>
            </div>
          </td>

          <td>
            ${new Date(
              user.joinedAt
            ).toLocaleTimeString(
              undefined,
              {
                hour: 'numeric',
                minute: '2-digit'
              }
            )}
          </td>

          <td>
            <div class="queue-actions">

              <button
                class="btn btn-outline btn-small"
                data-action="queue-move"
                data-direction="up"
                data-service-id="${selectedService.id}"
                data-user-id="${user.id}"
                aria-label="Move ${escapeHTML(user.name)} up"
                ${index === 0 ? 'disabled' : ''}
              >
                ↑
              </button>

              <button
                class="btn btn-outline btn-small"
                data-action="queue-move"
                data-direction="down"
                data-service-id="${selectedService.id}"
                data-user-id="${user.id}"
                aria-label="Move ${escapeHTML(user.name)} down"
                ${
                  index === queue.length - 1
                    ? 'disabled'
                    : ''
                }
              >
                ↓
              </button>

              <button
                class="btn btn-danger btn-small"
                data-action="queue-remove"
                data-service-id="${selectedService.id}"
                data-user-id="${user.id}"
              >
                Remove
              </button>

            </div>
          </td>
        </tr>
      `;
    }).join('');

  return shell(`
    <div class="page">

      <div class="page-header">
        <div>
          <div class="eyebrow">
            ADMIN PORTAL
          </div>

          <h1>
            Queue Management
          </h1>

          <p class="muted">
            View and manage users waiting for each service.
          </p>
        </div>
      </div>

      <div class="admin-service-tabs">
        ${serviceButtons}
      </div>

      <div class="grid grid-3 admin-queue-summary">

        <div class="card">
          <div class="stat-label">
            SELECTED SERVICE
          </div>

          <div class="stat-value admin-stat-text">
            ${escapeHTML(selectedService.name)}
          </div>
        </div>

        <div class="card">
          <div class="stat-label">
            CURRENT QUEUE
          </div>

          <div class="stat-value">
            ${queue.length}
          </div>

          <div class="stat-sub">
            People currently waiting
          </div>
        </div>

        <div class="card">
          <div class="stat-label">
            QUEUE STATUS
          </div>

          <div class="stat-value admin-stat-text">
            ${
              selectedService.open
                ? 'Open'
                : 'Closed'
            }
          </div>
        </div>

      </div>

      <div class="queue-toolbar">

        <div>
          <h2>
            ${escapeHTML(selectedService.name)} Queue
          </h2>

          <p class="muted">
            Use the arrows to change queue order,
            or remove a user from the queue.
          </p>
        </div>

        <button
          class="btn btn-primary"
          data-action="serve-next"
          data-service-id="${selectedService.id}"
          ${queue.length === 0 ? 'disabled' : ''}
        >
          Serve next user →
        </button>

      </div>

      ${
        queue.length
          ? `
            <div class="card table-wrap">
              <table class="table queue-table">

                <thead>
                  <tr>
                    <th>Position</th>
                    <th>User</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  ${queueRows}
                </tbody>

              </table>
            </div>
          `
          : `
            <div class="card empty">

              <div class="empty-icon">
                ✓
              </div>

              <h2>
                No one is waiting
              </h2>

              <p>
                The ${escapeHTML(selectedService.name)}
                queue is currently empty.
              </p>

            </div>
          `
      }

      <p class="muted admin-demo-note">
        Queue users and actions are mock data for the
        Assignment 2 front-end demonstration.
      </p>

    </div>
  `);
}

