# QueueSmart A2 front end: authentication and user screens

This is one part of the team project. It covers login, registration, user dashboard, join queue, queue status, history, and in-app notifications. The Admin Dashboard, Service Management, and Queue Management screens still need to be added by teammates.

**Technology:** plain HTML, CSS, and JavaScript ES modules. This keeps A2 easy to run without installing a framework while giving each team feature its own files. Forms use semantic HTML and client-side validation; layouts are responsive. The shared data layer can be replaced with API calls in A3.

## Run

With Node.js installed, start the local server in this folder:

```bash
npm start
```

Visit `http://localhost:8000`. Stop the server with Ctrl+C. Run `npm test` separately for the flow smoke test. No `npm install` is needed. The browser uses ES modules, so opening `index.html` as a `file://` page may be blocked.

## Demo

1. Create an account with a name, email, and 8–72 character password. Log out and log back in.
2. Join a service from the dashboard or Join a queue screen. One active queue is allowed per account.
3. On Queue status, select **Simulate queue moving** to update position and trigger notifications. At position #1, select it again to simulate service.
4. History records served and left queues. Leaving prompts for confirmation.
5. The bell opens in-app notifications; **Mark all read** updates the unread count.

Email format, required fields, maximum lengths, password length, and confirmation are validated in the browser. Data is stored in this browser only. Services, waits, and movement are mocked.

## Team development

Read [the integration guide](docs/TEAM_INTEGRATION.md). The feature folders let teammates add admin screens without editing user screens. Changes to shared routes, authentication role, services, and queue data should be coordinated.

## A2 screenshots

Capture Login, Registration, User Dashboard, Join Queue, Queue Status, History, and Notifications. Teammates should add Admin Dashboard, Service Management, and Queue Management screenshots to the single submission document.
