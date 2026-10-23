# QueueSmart team integration guide

## Where to work

| Area | Files | Owner |
| --- | --- | --- |
| Login, registration, form validation | `src/features/auth/auth.js` | Authentication contributor |
| User dashboard, join, status, history | `src/features/user/` | User UI contributor |
| Admin dashboard, services, queue controls | `src/features/admin/` | Admin UI contributors |
| API services and per-account cache | `src/data/` | Agree on changes as a team |
| Shared formatting and app state | `src/shared/` | Agree on changes as a team |
| Navigation and event wiring | `src/app.js` | Integrate together |
| Styling | `assets/styles.css` | Add clearly labeled admin sections or split into separate stylesheets |

## Current data contract

- `SERVICES`: `{ id, name, description, expectedDuration, priority, icon, wait, length, open }`. `id` is stable and used by queues/history. `wait` is minutes and `length` is number waiting.
- Session: `{ name, email, role: 'user' | 'admin', token }`. The server determines roles; public registration always creates a user. Legacy sessions without tokens are cleared.
- Per-user cache: `{ queue: null | { id, serviceId, position, estimate, joinedAt, priority, ... }, history: [], notifications: [] }`.
- Notification: `{ id, entryId, serviceId, type, text, time, read }`. Completed history entries include the visit ID, service name snapshot, outcome, and finishedAt.
- `src/data/store.js` stores only the session in localStorage; queue/history/notifications and admin queues are transient API caches. Views read through it; `refreshAccountData()` in `src/data/api.js` refreshes the caches.

## Integrating screens

1. Views return HTML strings using `src/data/store.js` and `src/data/services.js` caches.
2. Mutations call the API, refresh the cache, then render. Never write queue or history records in the browser.
3. Admin Queue Management lists real entries and serves the next user. The old mock reorder/remove controls are removed; ordering is owned by the backend’s priority/FIFO rules.
4. Navigation, session restoration, and a five-second poll refresh server state. Polling skips service forms and confirmation dialogs.
5. Use a separate browser profile/private window to demonstrate user and admin sessions simultaneously.

## A3 status

All six A3 modules are server APIs in `src/backend/`. The UI calls them through `src/data/api.js` with `Authorization: Bearer <token>`. Passwords are hashed in memory; sessions die on logout or process restart.

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

Queue and wait-time logic lives in `queues.js` and `wait-time.js`. Notification
triggers live in `notifications.js`; completed-visit snapshots live in `history.js`.
`memory.js` owns the records and `resetMemory()` clears them for tests.
See README for full queue/notification/history contracts.

| Method | Path | Who |
| --- | --- | --- |
| POST / DELETE | `/api/queues/:serviceId` | user (join / leave) |
| GET | `/api/queue/me` | signed-in |
| GET | `/api/queues/:serviceId` | admin |
| POST | `/api/queues/:serviceId/serve` | admin |
| GET | `/api/notifications` | signed-in, own account |
| POST | `/api/notifications/read-all` | signed-in, own account |
| GET | `/api/history` | signed-in, own account |

Notifications/history have no writable text, timestamp, outcome, or account-ID
fields. Their values are generated from validated queue/service records.
Failed requests cannot create events; reads do not create duplicate notifications.

## Module 1 and 2 request contracts

Registration accepts `{name, email, password, confirm}`; login accepts `{email, password}`. Both return `{user: {id, name, email, role}, token}`. Names are required strings up to 80 characters, email addresses up to 254 characters, and passwords 8–72 characters. Registration requires matching confirmation. Email addresses are trimmed and normalized to lowercase. Use the seeded admin account listed in README; registration cannot grant admin access.

Service creation requires `{name, description, expectedDuration, priority}`. Name and description are required strings limited to 100 and 500 characters. Duration is positive minutes (a number or numeric form string); priority is `low`, `medium`, or `high`. PUT accepts any subset of these fields plus boolean `open`, and requires at least one recognized field. Creation/update returns `{service}`; listing returns `{services}`. Queue counts and wait values are computed from real in-memory queue entries.

Errors return `{error, fields?}`: 400 for invalid fields or JSON, 401 for missing/invalid authentication, 403 for users attempting admin operations, 404 for unknown routes/services, and 409 for duplicate registration. Field errors map input names to messages. Run `npm test` or `npm run test:coverage`; API tests reset in-memory state between cases. The coverage report covers imported application files; the standalone HTTP listener is not included.
