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

- `SERVICES`: `{ id, name, description, expectedDuration, priority, icon, wait, length, open }`. `id` is stable and used by queues/history. `wait` is minutes and `length` is number waiting.
- Session: `{ name, email, role: 'user' | 'admin', token }`. The server determines roles; public registration always creates a user. Legacy sessions without tokens are cleared.
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

## A3 status

Authentication and service management are server APIs in `src/backend/`. The UI calls them through `src/data/api.js` with `Authorization: Bearer <token>`. Passwords are hashed in memory; sessions die on logout or process restart.

| Method | Path | Who |
| --- | --- | --- |
| POST | `/api/auth/register` | public |
| POST | `/api/auth/login` | public |
| POST | `/api/auth/logout` | signed-in |
| GET | `/api/auth/me` | signed-in |
| GET | `/api/services` | signed-in |
| GET | `/api/services/:id` | signed-in |
| POST | `/api/services` | admin |
| PUT | `/api/services/:id` | admin |

Queue, wait-time, notifications, and history are still client mock data. Add matching `/api` routes and keep using `handleApi` in `src/backend/http.js`.

## Module 1 and 2 request contracts

Registration accepts `{name, email, password, confirm}`; login accepts `{email, password}`. Both return `{user: {id, name, email, role}, token}`. Names are required strings up to 80 characters, email addresses up to 254 characters, and passwords 8–72 characters. Registration requires matching confirmation. Email addresses are trimmed and normalized to lowercase. Use the seeded admin account listed in README; registration cannot grant admin access.

Service creation requires `{name, description, expectedDuration, priority}`. Name and description are required strings limited to 100 and 500 characters. Duration is positive minutes (a number or numeric form string); priority is `low`, `medium`, or `high`. PUT accepts any subset of these fields plus boolean `open`, and requires at least one recognized field. Creation/update returns `{service}`; listing returns `{services}`. Queue counts and wait values are demo placeholders pending teammates’ modules.

Errors return `{error, fields?}`: 400 for invalid fields or JSON, 401 for missing/invalid authentication, 403 for users attempting admin operations, 404 for unknown routes/services, and 409 for duplicate registration. Field errors map input names to messages. Run `npm test` or `npm run test:coverage`; API tests reset in-memory state between cases. The coverage report covers imported application files; the standalone HTTP listener is not included.
