-- Dependency: Service(service_id) must be a primary or unique text key.
-- SQLite allows creating this table before Service, but inserts require Service.
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS Queue (
    queue_id TEXT NOT NULL PRIMARY KEY
        CHECK (length(queue_id) BETWEEN 1 AND 100 AND queue_id = trim(queue_id)),
    service_id TEXT NOT NULL
        CHECK (length(service_id) BETWEEN 1 AND 100 AND service_id = trim(service_id)),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        CHECK (length(created_at) = 24
            AND strftime('%Y-%m-%dT%H:%M:%fZ', julianday(created_at)) IS NOT NULL
            AND strftime('%Y-%m-%dT%H:%M:%fZ', julianday(created_at)) = created_at),
    FOREIGN KEY (service_id) REFERENCES Service(service_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) STRICT;

-- One current queue per service; reopening updates status on the same record.
CREATE UNIQUE INDEX IF NOT EXISTS queue_service_unique ON Queue(service_id);

COMMIT;
