-- Durable account activity; apply after the queue migrations.
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

-- Composite references prevent activity from being assigned to another user.
CREATE UNIQUE INDEX IF NOT EXISTS queue_entry_owner ON QueueEntry(entry_id, user_id);

CREATE TABLE IF NOT EXISTS Notification (
    notification_id TEXT NOT NULL PRIMARY KEY
        CHECK (length(notification_id) BETWEEN 1 AND 100 AND notification_id = trim(notification_id)),
    user_id TEXT NOT NULL,
    entry_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('joined', 'approaching', 'served', 'left')),
    message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 1000 AND length(trim(message)) > 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        CHECK (length(created_at) = 24
            AND strftime('%Y-%m-%dT%H:%M:%fZ', julianday(created_at)) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', julianday(created_at)) = created_at),
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'viewed')),
    FOREIGN KEY (entry_id, user_id) REFERENCES QueueEntry(entry_id, user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    UNIQUE (entry_id, type)
) STRICT;
CREATE INDEX IF NOT EXISTS notification_user ON Notification(user_id);

CREATE TABLE IF NOT EXISTS VisitHistory (
    entry_id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL,
    service_name TEXT NOT NULL CHECK (length(service_name) BETWEEN 1 AND 100 AND length(trim(service_name)) > 0),
    position INTEGER NOT NULL CHECK (position >= 1),
    estimate REAL CHECK (estimate >= 0),
    outcome TEXT NOT NULL CHECK (outcome IN ('Served', 'Left queue')),
    -- Old completed entries did not store completion time or an estimate snapshot.
    -- Preserve that missing information as NULL instead of inventing values.
    finished_at TEXT
        CHECK (finished_at IS NULL OR (length(finished_at) = 24
            AND strftime('%Y-%m-%dT%H:%M:%fZ', julianday(finished_at)) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', julianday(finished_at)) = finished_at)),
    CHECK ((finished_at IS NULL AND estimate IS NULL)
        OR (finished_at IS NOT NULL AND estimate IS NOT NULL)),
    FOREIGN KEY (entry_id, user_id) REFERENCES QueueEntry(entry_id, user_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) STRICT;
CREATE INDEX IF NOT EXISTS history_user ON VisitHistory(user_id, finished_at);

CREATE TRIGGER IF NOT EXISTS history_completed_insert
BEFORE INSERT ON VisitHistory
WHEN NOT EXISTS (SELECT 1 FROM QueueEntry WHERE entry_id = NEW.entry_id
    AND status = CASE NEW.outcome WHEN 'Served' THEN 'served' ELSE 'canceled' END)
BEGIN
    SELECT RAISE(ABORT, 'History must match a completed queue entry');
END;
CREATE TRIGGER IF NOT EXISTS history_completed_update
BEFORE UPDATE ON VisitHistory
WHEN NOT EXISTS (SELECT 1 FROM QueueEntry WHERE entry_id = NEW.entry_id
    AND status = CASE NEW.outcome WHEN 'Served' THEN 'served' ELSE 'canceled' END)
BEGIN
    SELECT RAISE(ABORT, 'History must match a completed queue entry');
END;

-- Recover already completed visits. Their original service-name snapshots were
-- not persisted; only the current service name can be recovered on upgrade.
INSERT INTO VisitHistory (entry_id, user_id, service_name, position, estimate, outcome, finished_at)
SELECT e.entry_id, e.user_id, s.name, e.position, NULL,
    CASE e.status WHEN 'served' THEN 'Served' ELSE 'Left queue' END, NULL
FROM QueueEntry e JOIN Queue q ON q.queue_id = e.queue_id
JOIN Service s ON s.service_id = q.service_id
WHERE e.status IN ('served', 'canceled')
ON CONFLICT(entry_id) DO NOTHING;
COMMIT;
