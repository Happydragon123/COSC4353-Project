# QueueSmart

QueueSmart is an in-memory web application for joining and managing service queues. This project was developed for COSC 4353 - Software Design

The prototype includes user account screens, queue interactions, and an admin view for monitoring services and managing waiting queues. Authentication, services, queues, wait estimates, notifications, and history run on an in-memory Node API. The front end reads these API responses. No database is used.

## Features

### User experience

- Register, log in, and log out
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

Accounts, services, queue entries, notifications, and history are stored in server memory and reset when the process stops. Only the session is stored in the browser; the old A2 mock queue/history data is no longer read.

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

## Run locally

Install Node.js, then run these commands from the project directory:

npm start
Then open in http://localhost:8000/

## Demo

1. Create an account with a name, email, and 8–72 character password. Log out and log back in.
2. Or, you can log into an admin account with email:  admin@queuesmart.local and password: admin1234
3. Join a service from the dashboard or Join a queue screen. One active queue is allowed per account.
4. Open a separate browser profile or private window, log in as the demo admin, and open Queue Management. Select the service and **Serve next user**. The user’s queue status, notifications, and history refresh within five seconds; **Refresh status** also reloads immediately. Separate tabs in one profile share the login session.
5. History records served and left queues. Leaving prompts for confirmation.
6. The bell opens in-app notifications; **Mark all read** updates the unread count.

Email format, required fields, maximum lengths, password length, and confirmation are validated in the browser and again on the server. Restarting `npm start` clears all backend records (the seeded admin is recreated).

## Tests

```bash
npm test
npm run test:coverage
```

Tests cover business rules, validation, priority/FIFO ordering, wait estimates,
notification thresholds and deduplication, history snapshots, account isolation,
logout/reset behavior, and frontend API flows. `npm run test:coverage` prints
a coverage report; the standalone HTTP listener (`server.js`) is not included.
