# QueueSmart SQLite database

`queuesmart.db` contains the account, profile, service, queue, queue-entry, notification,
and visit-history schemas. Starting the backend initializes missing tables and seeds
missing demo records. Existing records are preserved.

SQLite stores the database in a file; no separate database server is needed.
The backend uses this file for all application records, including notifications,
read status, and history snapshots. Session tokens remain in memory.

From the project root, open the database using the SQLite command-line tool:

```sh
sqlite3 database/queuesmart.db
```

Inside SQLite, use `.tables` to list tables, `.schema` to inspect
the schema, and `.quit` to exit.

When adding relationships, enable foreign key enforcement on **every backend
database connection** using `PRAGMA foreign_keys = ON;`. This setting is per
connection and is not saved in the database file.

To recreate an empty database if the file is missing:

```sh
sqlite3 database/queuesmart.db 'VACUUM;'
```

Running this command on an existing database preserves its tables and data.

## UserCredentials

Requires SQLite 3.37 or newer for strict column types. Apply the table definition
from the project root (safe to rerun; existing records are preserved):

```sh
sqlite3 database/queuesmart.db < database/001_user_credentials.sql
```

| Column | Rules |
| --- | --- |
| `user_id` | Text primary key, 1–100 characters, no surrounding spaces; compatible with existing backend IDs |
| `email` | Required, unique ignoring case, maximum 254 characters, basic email shape and no whitespace |
| `password_hash` | Required encoded salted scrypt hash; plaintext is rejected by the format constraint |
| `role` | `user` (default) or `admin`, matching current backend role names |

Passwords should be hashed rather than reversibly encrypted. Before inserting an
account, generate the encoded value with Node's built-in crypto module:

```js
import { randomBytes, scryptSync } from 'node:crypto';

const salt = randomBytes(16).toString('hex');
const hash = scryptSync(password, salt, 64).toString('hex');
const passwordHash = `scrypt$${salt}$${hash}`;
```

Use the default Node scrypt parameters (`N=16384`, `r=8`, `p=1`) for this format.
On login, split the stored value on `$`, derive the candidate hash using the
stored salt, and compare the hash buffers with `timingSafeEqual` from
`node:crypto`. The format check cannot prove that a value was actually hashed;
the backend must perform hashing and must never return hashes to the client.
The backend now uses this scrypt format and timing-safe comparison.

The backend must also validate email syntax, normalize email with
`trim().toLowerCase()`, enforce the existing password length rules, generate the
user ID, use parameterized SQL, and assign `user` on public registration (never
accept a client-selected administrator role). Registration and login now use SQLite.

Other tables can reference `UserCredentials(user_id)` or the unique
`UserCredentials(email)` column. Use `COLLATE NOCASE` for referencing email columns
to keep email comparisons consistent. Prefer user IDs for relationships because
emails can change.

Run the schema tests with Python 3 (standard library only):

```sh
python3 -B -m unittest discover -s database -p 'test_*.py'
```

Tests use a temporary in-memory database and leave `queuesmart.db` unchanged.

## Queue and QueueEntry (assignment tables 4 and 5)

The backend automatically applies migrations on startup. For manual setup, apply
`001_user_credentials.sql`, then the supporting tables and queue schemas:

```sh
sqlite3 database/queuesmart.db < database/003_queue_dependencies.sql
sqlite3 database/queuesmart.db < database/004_queue.sql
sqlite3 database/queuesmart.db < database/005_queue_entry.sql
```

These scripts are safe to rerun and preserve existing rows. Queue inserts require
`Service(service_id)`. The dependency script supplies `Service` and `UserProfile`
so queues can resolve users and services after restart. Coordinate these definitions
with the owners of tables 2 and 3. Python queue schema tests use a minimal Service
fixture only in temporary databases.

| Table | Columns and rules |
| --- | --- |
| `Queue` | `queue_id`: text primary key; `service_id`: required unique reference to `Service(service_id)`; `status`: `open` (default) or `closed`; `created_at`: required UTC timestamp, defaults to now |
| `QueueEntry` | `entry_id`: text primary key for each visit; `queue_id`: reference to `Queue(queue_id)`; `user_id`: reference to `UserCredentials(user_id)`; `position`: required positive integer; `joined_at`: required UTC timestamp, defaults to now; `status`: `waiting` (default), `served`, or `canceled`; `priority`: `low`, `normal` (default), `medium`, or `high` |

All IDs must be 1–100 characters with no surrounding spaces. Tables use STRICT
types. Timestamps use the JavaScript `toISOString()` format, for example
`2026-11-06T15:00:00.000Z`. Invalid dates and statuses are rejected.

There is one queue record per service; open/close updates that record's status.
Partial unique indexes enforce one waiting entry per user across all queues and
one waiting user per position within a queue. Completed visits can share old
positions. Each rejoin needs a new `entry_id`; serve/leave should update status to
`served`/`canceled` instead of deleting the record. Foreign keys restrict deleting
referenced services, queues, or users and cascade identifier updates.

Triggers reject waiting inserts, transfers, or reactivations into closed queues.
Closing a queue keeps existing waiting entries so they can still be served or
cancel their visit, matching the current backend behavior.

Backend integration must use parameterized SQL and transactions for joins,
serve/leave, and position updates. Order waiting entries by priority (high first;
normal and medium equivalent), join time, then `entry_id` for ties. Maintain
contiguous positions starting at 1. Because SQLite checks uniqueness immediately,
move affected positions to unused positive values before assigning final
positions during reordering, all within the same transaction. The schema enforces
positive unique waiting positions; the backend must enforce ordering and gaps.
The backend must also continue enforcing authentication and administrator access.

The schema tests cover defaults, validation, foreign keys, duplicate waiting
entries/positions, repeat visits, closed queues, safe schema reruns, and persistence
across database connections. The queue APIs now use SQLite through `src/backend/queue-repository.js`.

## Backend runtime

Use Node.js 22.16+ (Node 24 recommended) and run `npm start` from the project root.
`QUEUESMART_DB_PATH` optionally selects another existing-directory database path.
Foreign keys are enabled on the connection; writes use bound parameters and queue
mutations use `BEGIN IMMEDIATE` transactions. Startup records applied scripts in
`schema_migrations`; `006_queue_runtime.sql` adds a persisted
`approaching_notified` flag so fetching a fresh queue entry does not duplicate
approaching-turn events. That ALTER migration is applied once by the backend;
do not rerun it manually. A database initialized with the earlier three tables
is upgraded automatically.

Supporting `Service` columns are `service_id`, `name`, `description`,
`expected_duration`, `priority`, and `icon`; `UserProfile` stores `user_id`,
`full_name`, optional `contact_info`, and JSON `preferences`. Profile email is
retrieved through its credentials reference. Authentication uses salted scrypt
hashes from `UserCredentials`. Session tokens remain in memory and expire on
restart. The static server blocks database and backend source downloads.

The backend maintains contiguous waiting positions and priority/FIFO order within
transactions. Arrival order uses the persisted entry rowid as the tie breaker,
matching existing FIFO behavior even for joins in the same millisecond. Serve-next
selects and completes the next entry under the same database write lock.

Run `npm run test:coverage` for backend/UI tests. The restart test in
`tests/queue-persistence.test.js` starts three independent Node processes with the
same temporary database and verifies restored login, queue contents, service
status, completion status, and foreign-key integrity. It also verifies that old
session tokens do not survive restart. `tests/activity-persistence.test.js` verifies
notification content and read status, history snapshots, profile edits, account
isolation, schema validation, legacy upgrades, and complete rollback on failed
activity writes. The coverage command enforces at least 80% line, branch, and
function coverage for backend modules and shared validation.


## Notification and history (assignment table 6)

`007_notification_history.sql` is applied automatically after the queue migrations.
It is also safe to rerun manually. `Notification` stores its ID, owning user and
visit, message, creation timestamp, event type, and `sent`/`viewed` status.
`VisitHistory` stores the visit owner, service-name snapshot, final position,
estimated wait, outcome, and completion timestamp. QueueEntry supplies the
original join time and priority, and Queue supplies the service reference.

Both tables use STRICT types and composite foreign keys to the owning queue entry.
Checks enforce required fields, message/name lengths, canonical timestamps,
positive positions, nonnegative estimates, and valid event/outcome/status values.
An event type can appear only once per visit. History triggers require a matching
served/canceled QueueEntry. Each queue action saves queue changes, notifications,
notification flags, and the completion snapshot in one transaction. Repository
transactions use savepoints inside the outer action transaction.

The existing notification and history API response shapes are preserved, including
the frontend `read` boolean mapped from the database status. Read-all updates only
the authenticated account. The existing screens already consume these API responses.

On upgrade, already served/canceled QueueEntry rows are recovered into history.
Their completion timestamps and estimate snapshots were never saved, so those two
fields are `null`; the recovered service name is the current name at migration
time. Original join times and outcomes remain available. New completions capture
their actual completion time and service-name/estimate snapshots. Previously lost
in-memory notification text and read state cannot be reconstructed. Only newly
persisted notifications survive subsequent restarts.
