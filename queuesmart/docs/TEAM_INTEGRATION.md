# QueueSmart team integration guide

## Where to work

| Area | Files | Owner |
| --- | --- | --- |
| Login, registration, form validation | `src/features/auth/auth.js` | Authentication contributor |
| User dashboard, join, status, history | `src/features/user/` | User UI contributor |
| Admin dashboard, services, queue controls | `src/features/admin/` | Admin UI contributors |
| Mock services and per-account data | `src/data/` | Agree on changes as a team |
| Shared formatting and app state | `src/shared/` | Agree on changes as a team |
| Navigation and event wiring | `src/app.js` | Integrate together |
| Styling | `assets/styles.css` | Add clearly labeled admin sections or split into separate stylesheets |

## Current data contract

- `SERVICES`: `{ id, name, description, icon, wait, length, open }`. `id` is stable and used by queues/history. `wait` is minutes and `length` is number waiting.
- Session: `{ name, email }`; add `role: 'user' | 'admin'` when the team implements admin login. Existing browser data will lack `role`, so default it to `user`.
- Per-user data: `{ queue: null | { serviceId, position, estimate, joinedAt, status }, history: [], notifications: [] }`.
- Notification: `{ id, text, time, read }`. History entry adds `outcome` and `finishedAt` to the queue record.
- The `src/data/store.js` module owns browser storage; the views should read through it rather than accessing `localStorage` directly.

## Integrating admin screens

1. Decide whether admins register separately or receive demo admin accounts. Add `role` to the account/session shape in authentication.
2. Implement admin views/actions in `src/features/admin/`. Export named screen functions that return HTML strings, like `adminDashboard()`.
3. Register those functions as routes in `src/app.js`; add admin navigation and render only the appropriate role's screens.
4. Agree on one mutable service/queue store before implementing open/close, create/edit, reorder, remove, or serve next. The current `SERVICES` array is static and user queue position is stored per browser account, so admin controls cannot yet change the user's view.
5. Keep the `data-page`, `data-select`, and action button attributes distinct. Add delegated click handlers in `src/app.js` or a clearly registered admin handler.
6. Merge small pull requests into the same repository. Put screenshots and each member's contributions in the A2 document; Git history should reflect actual work.

## A3 handoff

`src/data/store.js` is mock persistence, not secure auth. Replace browser storage with authenticated API requests. Passwords are currently stored in clear text solely to simulate login in A2; never use this approach with real user data. Wait time and queue movement are sample values.
