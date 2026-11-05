"""Run with: python3 -m unittest discover -s database -p 'test_*.py'."""

import hashlib
from pathlib import Path
import sqlite3
import unittest


SCHEMA = Path(__file__).with_name('001_user_credentials.sql').read_text()
SALT = '0123456789abcdef0123456789abcdef'
HASH = hashlib.scrypt(b'test-password', salt=SALT.encode(), n=16384, r=8, p=1).hex()
PASSWORD_HASH = f'scrypt${SALT}${HASH}'


class UserCredentialsTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.executescript(SCHEMA)

    def insert(self, **overrides):
        values = dict(user_id='user-123', email='student@example.com',
                      password_hash=PASSWORD_HASH, role='user')
        values.update(overrides)
        self.db.execute(
            'INSERT INTO UserCredentials (user_id, email, password_hash, role) '
            'VALUES (:user_id, :email, :password_hash, :role)', values)

    def test_round_trip_default_role_and_schema_rerun(self):
        self.db.execute(
            'INSERT INTO UserCredentials (user_id, email, password_hash) VALUES (?, ?, ?)',
            ('user-123', 'student@example.com', PASSWORD_HASH))
        self.db.executescript(SCHEMA)
        self.assertEqual(self.db.execute('SELECT * FROM UserCredentials').fetchone(),
                         ('user-123', 'student@example.com', PASSWORD_HASH, 'user'))

    def test_administrator_role(self):
        self.insert(role='admin')
        self.assertEqual(self.db.execute('SELECT role FROM UserCredentials').fetchone(), ('admin',))

    def test_unique_email_ignores_case_and_id_is_unique(self):
        self.insert()
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert(user_id='user-456', email='STUDENT@example.com')
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert(email='other@example.com')

    def test_required_fields_lengths_formats_and_roles(self):
        invalid = [
            {column: None} for column in ('user_id', 'email', 'password_hash', 'role')
        ] + [
            {'user_id': ''}, {'user_id': 'x' * 101}, {'user_id': ' user-123'},
            {'email': ''}, {'email': 'invalid'}, {'email': 'a@@b.com'},
            {'email': 'a b@example.com'}, {'email': 'a\tb@example.com'},
            {'email': 'a@example.com '}, {'email': 'x' * 250 + '@b.com'},
            {'password_hash': 'plaintext-password'},
            {'password_hash': 'scrypt$' + 'z' * 32 + '$' + HASH},
            {'password_hash': f'scrypt${SALT}$' + 'z' * 128},
            {'password_hash': b'not-text'}, {'role': 'owner'},
        ]
        for values in invalid:
            with self.subTest(values=values):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.insert(**values)


if __name__ == '__main__':
    unittest.main()
