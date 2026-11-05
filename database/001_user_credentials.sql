-- Apply from the project root:
-- sqlite3 database/queuesmart.db < database/001_user_credentials.sql
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS UserCredentials (
    user_id TEXT NOT NULL PRIMARY KEY
        CHECK (length(user_id) BETWEEN 1 AND 100 AND user_id = trim(user_id)),
    email TEXT NOT NULL COLLATE NOCASE UNIQUE
        CHECK (
            length(email) BETWEEN 3 AND 254
            AND email = trim(email)
            AND email NOT GLOB '*[ ' || char(9) || char(10) || char(13) || ']*'
            AND email LIKE '_%@_%._%'
            AND length(email) - length(replace(email, '@', '')) = 1
        ),
    -- Encoded Node.js scrypt result: scrypt$<32 hex salt characters>$<128 hex hash characters>
    -- Hash before inserting. SQLite does not hash passwords automatically.
    password_hash TEXT NOT NULL
        CHECK (
            length(password_hash) = 168
            AND substr(password_hash, 1, 7) = 'scrypt$'
            AND substr(password_hash, 40, 1) = '$'
            AND substr(password_hash, 8, 32) NOT GLOB '*[^0-9a-f]*'
            AND substr(password_hash, 41, 128) NOT GLOB '*[^0-9a-f]*'
        ),
    role TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'admin'))
) STRICT;

COMMIT;
