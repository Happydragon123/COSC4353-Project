-- Supporting records needed to authenticate users and resolve services after restart.
-- Coordinate these column names with the owners of assignment tables 2 and 3.
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS UserProfile (
    user_id TEXT NOT NULL PRIMARY KEY REFERENCES UserCredentials(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    full_name TEXT NOT NULL CHECK (length(full_name) BETWEEN 1 AND 80),
    contact_info TEXT CHECK (contact_info IS NULL OR length(contact_info) <= 200),
    preferences TEXT NOT NULL DEFAULT '{}'
        CHECK (json_valid(preferences) AND json_type(preferences) = 'object' AND length(preferences) <= 2000)
) STRICT;
CREATE TABLE IF NOT EXISTS Service (
    service_id TEXT NOT NULL PRIMARY KEY
        CHECK (length(service_id) BETWEEN 1 AND 100 AND service_id = trim(service_id)),
    name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 500),
    expected_duration REAL NOT NULL CHECK (expected_duration > 0),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    icon TEXT NOT NULL DEFAULT '▤'
) STRICT;
COMMIT;
