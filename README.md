# QueueSmart

QueueSmart is a front-end prototype for joining and managing service queues. This project was developed for COSC 4353 - Software Design

The prototype includes user account screens, queue interactions, and an admin view for monitoring services and managing waiting queues. Queue and service data are simulated in the browser; this project does not currently connect to a production backend or database.

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

The Service Management screen is currently a placeholder.

## Technology

- HTML
- CSS
- JavaScript ES modules
- Node.js built-in HTTP server

The prototype stores account and application data in the browser. Queue activity and service behavior are simulated.

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

Email format, required fields, maximum lengths, password length, and confirmation are validated in the browser. Data is stored in this browser only. Services, waits, and movement are mocked.
