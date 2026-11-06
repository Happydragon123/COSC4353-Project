import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Node's test runner sets NODE_TEST_CONTEXT in each isolated test process.
const defaultPath = process.env.NODE_TEST_CONTEXT ? ':memory:' :
  fileURLToPath(new URL('../../database/queuesmart.db', import.meta.url));
export const databasePath = process.env.QUEUESMART_DB_PATH || defaultPath;
export const db = new DatabaseSync(databasePath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY) STRICT');
for (const name of ['001_user_credentials.sql', '003_queue_dependencies.sql',
  '004_queue.sql', '005_queue_entry.sql', '006_queue_runtime.sql']) {
  if (db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get(name)) continue;
  // The runtime column may already exist in a manually initialized database.
  if (name !== '006_queue_runtime.sql' ||
      !db.prepare('PRAGMA table_info(QueueEntry)').all().some(column => column.name === 'approaching_notified')) {
    db.exec(readFileSync(new URL(`../../database/${name}`, import.meta.url), 'utf8'));
  }
  db.prepare('INSERT INTO schema_migrations VALUES (?)').run(name);
}

export function transaction(work) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
