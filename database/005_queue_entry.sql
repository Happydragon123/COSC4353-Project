PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS QueueEntry (
    entry_id TEXT NOT NULL PRIMARY KEY
        CHECK (length(entry_id) BETWEEN 1 AND 100 AND entry_id = trim(entry_id)),
    queue_id TEXT NOT NULL
        CHECK (length(queue_id) BETWEEN 1 AND 100 AND queue_id = trim(queue_id)),
    user_id TEXT NOT NULL
        CHECK (length(user_id) BETWEEN 1 AND 100 AND user_id = trim(user_id)),
    position INTEGER NOT NULL CHECK (position >= 1),
    joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        CHECK (length(joined_at) = 24
            AND strftime('%Y-%m-%dT%H:%M:%fZ', julianday(joined_at)) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', julianday(joined_at)) = joined_at),
    status TEXT NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'served', 'canceled')),
    priority TEXT NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'medium', 'high')),
    FOREIGN KEY (queue_id) REFERENCES Queue(queue_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES UserCredentials(user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) STRICT;

-- Completed visits remain stored; a rejoin uses a fresh entry_id.
CREATE UNIQUE INDEX IF NOT EXISTS queue_entry_waiting_user
    ON QueueEntry(user_id) WHERE status = 'waiting';
CREATE UNIQUE INDEX IF NOT EXISTS queue_entry_waiting_position
    ON QueueEntry(queue_id, position) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS queue_entry_user_history ON QueueEntry(user_id, joined_at);

CREATE TRIGGER IF NOT EXISTS queue_entry_open_insert
BEFORE INSERT ON QueueEntry
WHEN NEW.status = 'waiting'
    AND EXISTS (SELECT 1 FROM Queue WHERE queue_id = NEW.queue_id AND status = 'closed')
BEGIN
    SELECT RAISE(ABORT, 'Cannot join a closed queue');
END;

CREATE TRIGGER IF NOT EXISTS queue_entry_open_update
BEFORE UPDATE OF queue_id, status ON QueueEntry
WHEN NEW.status = 'waiting'
    AND (OLD.status <> 'waiting' OR OLD.queue_id <> NEW.queue_id)
    AND EXISTS (SELECT 1 FROM Queue WHERE queue_id = NEW.queue_id AND status = 'closed')
BEGIN
    SELECT RAISE(ABORT, 'Cannot join a closed queue');
END;

COMMIT;
