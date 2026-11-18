import importlib.util
import io
from contextlib import redirect_stdout
from pathlib import Path
import os
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

PATH = Path(__file__).with_name("configure-private-finance-auth.py")
spec = importlib.util.spec_from_file_location("finance_auth", PATH)
auth = importlib.util.module_from_spec(spec)
spec.loader.exec_module(auth)


class AuthSetupTests(unittest.TestCase):
    def fixture(self, root):
        path = Path(root) / ".env"
        path.write_text("FINANCES_DB_PASSWORD=oldvalue\nFINANCES_API_TOKEN=" + "a" * 48 + "\n")
        path.chmod(0o600)
        return path

    def test_missing_credentials_and_no_secret_values_in_status(self):
        with TemporaryDirectory() as d:
            path = self.fixture(d)
            raw, values, meta = auth.load_env(path)
            self.assertEqual(auth.status(values)[0], [
                auth.SESSION_KEY, auth.PASSWORD_KEY
            ])
            self.assertEqual(auth.status(values)[1], [])
            self.assertNotIn("secret", raw)

    def test_interactive_setup_writes_valid_pbkdf2_hash_and_random_session(self):
        with TemporaryDirectory() as d:
            path = self.fixture(d)
            raw, data, meta = auth.load_env(path)
            password = "A-long-private-owner-password-2027"
            buffer = io.StringIO()
            with patch.object(auth.getpass, "getpass", side_effect=[password, password]), redirect_stdout(buffer):
                auth.setup(path, raw, data, meta)
            output = buffer.getvalue()
            self.assertNotIn(password, output)
            self.assertNotIn("salt", output)
            self.assertEqual(os.stat(path).st_mode & 0o777, 0o600)
            raw2, values2, meta2 = auth.load_env(path)
            self.assertEqual(auth.status(values2), ([], []))
            self.assertEqual(values2["FINANCES_DB_PASSWORD"], "oldvalue")
            salt, digest = values2[auth.PASSWORD_KEY].split(":")
            expected = auth.hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 310000, dklen=32).hex()
            self.assertEqual(digest, expected)
            self.assertNotIn(password, raw2)
            # Idempotent: no new password prompt or re-keying.
            with patch.object(auth.getpass, "getpass", side_effect=AssertionError("unexpected prompt")):
                auth.setup(path, raw2, values2, meta2)
            self.assertEqual(path.read_text(), raw2)
            self.assertEqual(list(Path(d).iterdir()), [path])

    def test_password_mismatch_leaves_env_unchanged(self):
        with TemporaryDirectory() as d:
            path = self.fixture(d)
            before = path.read_bytes()
            raw, values, meta = auth.load_env(path)
            with patch.object(auth.getpass, "getpass", side_effect=["long-valid-first-password", "long-valid-different-password"]):
                with self.assertRaisesRegex(ValueError, "mismatch"):
                    auth.setup(path, raw, values, meta)
            self.assertEqual(path.read_bytes(), before)

    def test_rejects_unprotected_env(self):
        with TemporaryDirectory() as d:
            path = self.fixture(d)
            path.chmod(0o644)
            with self.assertRaisesRegex(ValueError, "chmod 600"):
                auth.load_env(path)


if __name__ == "__main__":
    unittest.main()
