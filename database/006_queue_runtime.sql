-- Apply once, tracked by the backend schema_migrations table.
BEGIN TRANSACTION;
ALTER TABLE QueueEntry ADD COLUMN approaching_notified INTEGER NOT NULL DEFAULT 0
    CHECK (approaching_notified IN (0, 1));
COMMIT;
