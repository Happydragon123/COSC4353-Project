"""Queue schema tests use a minimal Service fixture until table #3 is delivered."""

from contextlib import closing
from pathlib import Path
import sqlite3
import tempfile
import unittest

from test_user_credentials import PASSWORD_HASH


ROOT = Path(__file__).parent
SCHEMAS = [ROOT / name for name in (
    '001_user_credentials.sql', '004_queue.sql', '005_queue_entry.sql')]


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.execute('PRAGMA foreign_keys = ON')
        self.db.execute('CREATE TABLE Service (service_id TEXT PRIMARY KEY) STRICT')
        for schema in SCHEMAS:
            self.db.executescript(schema.read_text())
        self.db.executemany('INSERT INTO Service VALUES (?)', [('s1',), ('s2',)])
        self.db.executemany(
            'INSERT INTO UserCredentials (user_id, email, password_hash) VALUES (?, ?, ?)',
            [('u1', 'one@example.com', PASSWORD_HASH), ('u2', 'two@example.com', PASSWORD_HASH)])
        self.queue()

    def queue(self, **overrides):
        values = dict(queue_id='q1', service_id='s1', status='open')
        values.update(overrides)
        columns = ', '.join(values)
        self.db.execute(f'INSERT INTO Queue ({columns}) VALUES ({", ".join("?" for _ in values)})',
                        list(values.values()))

    def entry(self, **overrides):
        values = dict(entry_id='e1', queue_id='q1', user_id='u1', position=1)
        values.update(overrides)
        columns = ', '.join(values)
        self.db.execute(f'INSERT INTO QueueEntry ({columns}) VALUES ({", ".join("?" for _ in values)})',
                        list(values.values()))

    def test_defaults_and_idempotent_schema(self):
        self.entry()
        for schema in SCHEMAS:
            self.db.executescript(schema.read_text())
        self.assertEqual(self.db.execute('SELECT status FROM Queue').fetchone(), ('open',))
        row = self.db.execute('SELECT status, priority, joined_at FROM QueueEntry').fetchone()
        self.assertEqual(row[:2], ('waiting', 'normal'))
        self.assertEqual(len(row[2]), 24)

    def test_queue_validation(self):
        invalid = [{key: None} for key in ('queue_id', 'service_id', 'status', 'created_at')]
        invalid += [dict(queue_id=''), dict(queue_id='x' * 101), dict(queue_id=' q2'),
                    dict(service_id=''), dict(service_id='missing'), dict(status='invalid'),
                    dict(created_at='yesterday'), dict(created_at='2026-02-30T00:00:00.000Z'),
                    dict(created_at=b'not-text')]
        for overrides in invalid:
            with self.subTest(overrides=overrides), self.assertRaises(sqlite3.IntegrityError):
                self.queue(**(dict(queue_id='q2', service_id='s2') | overrides))
        with self.assertRaises(sqlite3.IntegrityError):
            self.queue(queue_id='q2')

    def test_entry_validation(self):
        invalid = [{key: None} for key in (
            'entry_id', 'queue_id', 'user_id', 'position', 'joined_at', 'status', 'priority')]
        invalid += [dict(entry_id=''), dict(entry_id='x' * 101), dict(entry_id=' e1'),
                    dict(queue_id='missing'), dict(user_id='missing'), dict(position=0),
                    dict(position=-1), dict(position=1.5), dict(position='first'),
                    dict(status='left'), dict(priority='urgent'), dict(joined_at='invalid'),
                    dict(joined_at='2026-02-30T00:00:00.000Z')]
        for overrides in invalid:
            with self.subTest(overrides=overrides), self.assertRaises(sqlite3.IntegrityError):
                self.entry(**overrides)

    def test_waiting_uniqueness_and_repeat_visits(self):
        self.entry()
        self.queue(queue_id='q2', service_id='s2')
        for values in (dict(entry_id='e2', queue_id='q2'),
                       dict(entry_id='e2', user_id='u2'), dict(user_id='u2', position=2)):
            with self.subTest(values=values), self.assertRaises(sqlite3.IntegrityError):
                self.entry(**values)
        self.db.execute("UPDATE QueueEntry SET status = 'served' WHERE entry_id = 'e1'")
        self.entry(entry_id='e2')
        self.db.execute("UPDATE QueueEntry SET status = 'canceled' WHERE entry_id = 'e2'")
        self.entry(entry_id='e3')
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM QueueEntry').fetchone(), (3,))

    def test_closed_queue_blocks_join_and_reactivation(self):
        self.entry()
        self.db.execute("UPDATE Queue SET status = 'closed'")
        # Existing participants can still move or finish after closing.
        self.db.execute('UPDATE QueueEntry SET position = 2')
        with self.assertRaises(sqlite3.IntegrityError):
            self.entry(entry_id='e2', user_id='u2')
        self.db.execute("UPDATE QueueEntry SET status = 'canceled'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE QueueEntry SET status = 'waiting'")
        self.db.execute("UPDATE Queue SET status = 'open'")
        self.db.execute("UPDATE QueueEntry SET status = 'waiting'")

    def test_closed_queue_blocks_transfer(self):
        self.entry()
        self.queue(queue_id='q2', service_id='s2', status='closed')
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE QueueEntry SET queue_id = 'q2'")

    def test_relationships_protect_records_and_cascade_ids(self):
        self.entry()
        for sql in ('DELETE FROM Queue', 'DELETE FROM UserCredentials', 'DELETE FROM Service'):
            with self.subTest(sql=sql), self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(sql)
        self.db.execute("UPDATE Service SET service_id = 'renamed' WHERE service_id = 's1'")
        self.db.execute("UPDATE Queue SET queue_id = 'renamed'")
        self.db.execute("UPDATE UserCredentials SET user_id = 'renamed' WHERE user_id = 'u1'")
        self.assertEqual(self.db.execute('SELECT queue_id, user_id FROM QueueEntry').fetchone(),
                         ('renamed', 'renamed'))
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_persists_across_connections(self):
        self.entry()
        self.db.commit()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'queue.db'
            with closing(sqlite3.connect(path)) as stored:
                self.db.backup(stored)
            with closing(sqlite3.connect(path)) as reopened:
                self.assertEqual(reopened.execute(
                    'SELECT queue_id, user_id, position, status FROM QueueEntry').fetchone(),
                    ('q1', 'u1', 1, 'waiting'))


if __name__ == '__main__':
    unittest.main()
