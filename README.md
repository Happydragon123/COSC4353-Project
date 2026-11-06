# QueueSmart

QueueSmart is a web application for joining and managing service queues. This project was developed for COSC 4353 - Software Design

The prototype includes user account screens, queue interactions, and an admin view for monitoring services and managing waiting queues. The Node API persists accounts, profiles, services, queues, and queue entries in SQLite. The front end reads these API responses. Notifications and the history API currently use server memory.

## Features

### User experience

- Register, log in, and log out
- Retrieve and update a user profile, including optional contact information and preferences
- View the user dashboard and available services
- Join a service queue and view queue status
- Refresh queue status and receive automatic updates every five seconds
- View queue history and in-app notifications

### Admin experience

- View the admin dashboard, service status, and queue lengths
- Open or close a service queue
- View the queue for a selected service
- Serve the next person in priority and arrival order
- Create and edit services (name, description, expected duration, priority)

## Technology

- HTML
- CSS
- JavaScript ES modules
- Node.js HTTP server with REST APIs (`/api/auth/*`, `/api/services`, `/api/queues/*`, `/api/notifications`, `/api/history`)

Accounts, profiles, services, queue status, and all queue visits are stored in `database/queuesmart.db`. They survive server restarts. Sessions, notifications, and history API snapshots remain in memory; sign in again after restarting. Served/canceled entries remain in SQLite, but the history API still needs its separate database integration. The old A2 mock queue/history data is no longer read.

### Queue API

- `POST /api/queues/:serviceId` — join an open queue (`priority` may be `low`, `normal`, `medium`, or `high`)
- `DELETE /api/queues/:serviceId` — leave a queue
- `GET /api/queue/me` — retrieve the signed-in user's active queue entry and position
- `GET /api/queues/:serviceId` — view an ordered queue (administrator only)
- `POST /api/queues/:serviceId/serve` — serve and remove the next user (administrator only)

Queue entries are ordered by priority first and arrival order second. A user can wait in only one queue at a time.

Queue API entries include `estimate`, the estimated minutes until that user's turn:
`Math.ceil((position - 1) * expectedDuration)`. The first person has a zero-minute
wait. Estimates assume one service counter and are recalculated on each request
using the current priority order and service duration. Service responses derive
`length` from the actual queue and `wait` from the total time to serve that queue.
The user and administrator screens share these queue APIs. The user “Refresh status” button reloads server state; only administrators can serve a user.

### Notifications and history APIs

All three endpoints require a live bearer token and derive the account from it.
There are no client-supplied notification texts, history records, or account IDs.
Missing, invalid, or logged-out tokens return 401.

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/notifications` | `{notifications: [...]}` newest first |
| POST | `/api/notifications/read-all` | `{notifications: [...]}` after marking the account’s notifications read; no body required |
| GET | `/api/history` | `{history: [...]}` newest completion first |

Notifications include `{id, entryId, serviceId, type, text, time, read}`.
A successful join triggers `joined`; reaching position 1 or 2 triggers
`approaching` once per visit, including when joining an empty queue.
Serving or leaving also triggers `served` or `left` and checks who has moved
into the first two positions. Reads and failed queue operations trigger no events.
Marking all read is idempotent and future notifications remain unread.

History includes `{id, serviceId, serviceName, priority, joinedAt, position,
estimate, outcome, finishedAt}`. Completed visits have outcome `Served` or
`Left queue`; active participation remains available through `/api/queue/me`.
The position and estimate describe the visit at exit. Each rejoin creates a new
visit; service names are saved at completion so later edits do not rewrite history.
Notifications and history survive logout/login until the server restarts.

### Profile API

- `GET /api/profile` — retrieve the signed-in user's profile
- `PUT /api/profile` — update `fullName`, optional `contactInfo`, and/or `preferences`

The profile's email is an immutable reference to the authenticated account.

## Run locally

Install Node.js 22.16+ (Node 24 recommended), then run from the project directory. SQLite uses Node’s built-in `node:sqlite` module; no npm dependencies or database server are required. Tables and demo records are initialized automatically without clearing existing records:

npm start
Then open in http://localhost:8000/

## Demo

1. Create an account with a name, email, and 8–72 character password. Log out and log back in.
2. Or, you can log into an admin account with email:  admin@queuesmart.local and password: admin1234
3. Join a service from the dashboard or Join a queue screen. One active queue is allowed per account.
4. Open a separate browser profile or private window, log in as the demo admin, and open Queue Management. Select the service and **Serve next user**. The user’s queue status, notifications, and history refresh within five seconds; **Refresh status** also reloads immediately. Separate tabs in one profile share the login session.
5. History records served and left queues. Leaving prompts for confirmation.
6. The bell opens in-app notifications; **Mark all read** updates the unread count.

Email format, required fields, maximum lengths, password length, and confirmation are validated in the browser and again on the server. Restarting `npm start` preserves accounts and queues. The demo admin and default services are seeded only when missing; edits and queue open/closed status are preserved.

## Tests

```bash
npm test
npm run test:coverage
```

Tests cover business rules, validation, priority/FIFO ordering, wait estimates,
notification thresholds and deduplication, history snapshots, account isolation,
logout/reset behavior, SQLite transactions, restart persistence, and frontend API flows. `npm run test:coverage` prints
a coverage report; the standalone HTTP listener (`server.js`) is not included.

## SQLite queue integration (A4 tables 4 and 5)

The existing join, leave, current-queue, admin-view, serve-next, and service
open/close APIs now read and write SQLite. Queue changes run in transactions,
with priority/FIFO positions recalculated atomically. Served and canceled visits
are retained. Foreign keys and unique indexes prevent orphan entries, duplicate
waiting users, and duplicate waiting positions.

`database/003_queue_dependencies.sql` supplies the supporting user/profile and
service storage needed for queue entries to remain usable after restart. Coordinate
these columns with the teammates owning tables 2 and 3. Notifications/history
persistence remains separate work. See [database setup](database/README.md).

To use a separate database for a demo:

```sh
QUEUESMART_DB_PATH=/tmp/queuesmart-demo.db npm start
```

To check persistence manually, register a user and join a queue, stop the server,
restart with the same database path, then sign in with the same email/password.
Your queue entry and position should still appear. Use a separate browser profile
for the demo administrator to serve the user; restarting again should not restore
the completed visit as an active entry.

Run the database and backend tests:

```sh
python3 -B -m unittest discover -s database -p 'test_*.py' -v
npm run test:coverage
```

Node tests use isolated in-memory databases, and restart tests use temporary files;
they do not change the application database. Never set `QUEUESMART_DB_PATH` to
an application database when running tests. The test-only `resetMemory` helper
clears test records and refuses to run against file-backed databases.
