# QueueSmart

QueueSmart is a front-end prototype for joining and managing service queues. This project was developed for COSC 4353 - Software Design

The prototype includes user account screens, queue interactions, and an admin view for monitoring services and managing waiting queues. Authentication and service management run on an in-memory Node API. Queue participation, wait simulation, and admin mock lines are still handled in the browser until those A3 modules are added. There is no production database.

## Features

### User experience

- Register, log in, and log out
- View the user dashboard and available services
- Join a service queue and view queue status
- Simulate queue movement and service
- View queue history and in-app notifications

### Admin experience

- View the admin dashboard, service status, and queue lengths
- Open or close a service queue
- View the queue for a selected service
- Change the order of people waiting, remove a person, or serve the next person
- Create and edit services (name, description, expected duration, priority)

## Technology

- HTML
- CSS
- JavaScript ES modules
- Node.js HTTP server with REST APIs (`/api/auth/*`, `/api/services`)

Accounts, services, and API queue entries are stored in server memory and reset when the process stops. The current front-end queue screens still use their Assignment 2 browser simulation.

### Queue API

- `POST /api/queues/:serviceId` — join an open queue (`priority` may be `low`, `normal`, `medium`, or `high`)
- `DELETE /api/queues/:serviceId` — leave a queue
- `GET /api/queue/me` — retrieve the signed-in user's active queue entry and position
- `GET /api/queues/:serviceId` — view an ordered queue (administrator only)
- `POST /api/queues/:serviceId/serve` — serve and remove the next user (administrator only)

Queue entries are ordered by priority first and arrival order second. A user can wait in only one queue at a time.

## Run locally

Install Node.js, then run these commands from the project directory:

npm start
Then open in http://localhost:8000/

## Demo

1. Create an account with a name, email, and 8–72 character password. Log out and log back in.
2. Or, you can log into an admin account with email:  admin@queuesmart.local and password: admin1234
3. Join a service from the dashboard or Join a queue screen. One active queue is allowed per account.
4. On Queue status, select **Simulate queue moving** to update position and trigger notifications. At position #1, select it again to simulate service.
5. History records served and left queues. Leaving prompts for confirmation.
6. The bell opens in-app notifications; **Mark all read** updates the unread count.

Email format, required fields, maximum lengths, password length, and confirmation are validated in the browser and again on the server. Restarting `npm start` clears backend accounts and services (the seeded admin is recreated).

## Tests

```bash
npm test
npm run test:coverage
```
