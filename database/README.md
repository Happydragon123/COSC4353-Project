# QueueSmart SQLite database

`queuesmart.db` contains the `UserCredentials` table. No accounts have been added.
The team can add the other five required tables and connect the backend to this
file in their database integration work.

SQLite stores the database in a file; no separate database server is needed.
The current backend still uses memory until the team connects it to this file.

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
The existing in-memory SHA-256 helper does not produce this format and must be
replaced when the team connects authentication to the database.

The backend must also validate email syntax, normalize email with
`trim().toLowerCase()`, enforce the existing password length rules, generate the
user ID, use parameterized SQL, and assign `user` on public registration (never
accept a client-selected administrator role). These APIs are not connected yet.

Other tables can reference `UserCredentials(user_id)` or the unique
`UserCredentials(email)` column. Use `COLLATE NOCASE` for referencing email columns
to keep email comparisons consistent. Prefer user IDs for relationships because
emails can change.

Run the schema tests with Python 3 (standard library only):

```sh
python3 -B -m unittest discover -s database -p 'test_*.py'
```

Tests use a temporary in-memory database and leave `queuesmart.db` unchanged.
