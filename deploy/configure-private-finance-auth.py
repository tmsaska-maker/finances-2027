#!/usr/bin/env python3
"""One-time owner-run finance gateway authentication setup on the EXISTING Lightsail host.

Run interactively from Lightsail's SSH terminal. Never publish, log, or transmit
the owner's plaintext password. This script does not create a backup/database.
"""
from __future__ import annotations

import argparse
import getpass
import hashlib
import os
from pathlib import Path
import re
import secrets
import stat
import sys
import tempfile

ENV = Path("/opt/finances-2027/backend/deploy/.env")
SESSION_KEY = "FINANCES_SESSION_SECRET"
PASSWORD_KEY = "FINANCES_OWNER_PASSWORD_HASH"
API_KEY = "FINANCES_API_TOKEN"
HASH_RE = re.compile(r"^[0-9a-f]{48}:[0-9a-f]{64}$")


def load_env(path: Path) -> tuple[str, dict[str, str], os.stat_result]:
    if path.is_symlink() or not path.is_file():
        raise ValueError("Expected existing regular finance .env (no symlinks)")
    metadata = path.stat()
    if stat.S_IMODE(metadata.st_mode) & 0o077:
        raise ValueError("Finance .env must be private (chmod 600) before setup")
    raw = path.read_text(encoding="utf-8")
    data: dict[str, str] = {}
    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key in data:
            raise ValueError("Duplicate configuration key: " + key)
        data[key] = value.strip()
    return raw, data, metadata


def status(data: dict[str, str]) -> tuple[list[str], list[str]]:
    missing: list[str] = []
    invalid: list[str] = []
    if len(data.get(API_KEY, "")) < 32:
        invalid.append(API_KEY)
    session = data.get(SESSION_KEY, "")
    if not session:
        missing.append(SESSION_KEY)
    elif len(session) < 48 or any(c.isspace() for c in session):
        invalid.append(SESSION_KEY)
    digest = data.get(PASSWORD_KEY, "")
    if not digest:
        missing.append(PASSWORD_KEY)
    elif not HASH_RE.fullmatch(digest):
        invalid.append(PASSWORD_KEY)
    return missing, invalid


def setup(path: Path, raw: str, data: dict[str, str], meta: os.stat_result) -> None:
    missing, invalid = status(data)
    if invalid:
        raise ValueError("Invalid existing finance configuration: " + ", ".join(invalid))
    if not missing:
        print("Finance gateway auth already configured; no changes")
        return
    if PASSWORD_KEY in missing and not sys.stdin.isatty():
        raise ValueError("Password must be entered in an interactive SSH terminal")
    additions: list[str] = []
    if SESSION_KEY in missing:
        additions.append(SESSION_KEY + "=" + secrets.token_urlsafe(48))
    if PASSWORD_KEY in missing:
        first = getpass.getpass("New finance owner password (16-256 characters): ")
        second = getpass.getpass("Repeat finance owner password: ")
        if first != second or not 16 <= len(first) <= 256 or not first.strip():
            raise ValueError("Password mismatch or invalid length")
        salt = secrets.token_hex(24)
        digest = hashlib.pbkdf2_hmac(
            "sha256", first.encode("utf-8"), bytes.fromhex(salt), 310000, dklen=32
        ).hex()
        additions.append(PASSWORD_KEY + "=" + salt + ":" + digest)
        del first, second
    payload = raw + ("" if not raw or raw.endswith("\n") else "\n")
    payload += "\n".join(additions) + "\n"
    # Atomic replacement of existing config; the temporary file is not a backup.
    fd, tmp = tempfile.mkstemp(prefix=".finance-auth-", dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        os.fchown(fd, meta.st_uid, meta.st_gid)
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            output.write(payload)
            output.flush()
            os.fsync(output.fileno())
        os.replace(tmp, path)
        os.chmod(path, 0o600)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    print("Finance gateway authentication configured on existing server; no secrets printed")


def main() -> int:
    parser = argparse.ArgumentParser(description="Finance gateway owner authentication setup")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="Check names only; never print values")
    mode.add_argument("--setup", action="store_true", help="Interactive one-time setup, no GitHub secrets")
    args = parser.parse_args()
    try:
        if os.geteuid() != 0:
            raise ValueError("Use sudo on the existing Lightsail host")
        raw, values, meta = load_env(ENV)
        missing, invalid = status(values)
        if args.check:
            print("Finance gateway auth status: " + ("ready" if not (missing or invalid) else "needs_setup"))
            if missing:
                print("Missing keys: " + ", ".join(missing))
            if invalid:
                print("Invalid keys: " + ", ".join(invalid))
            return 1 if missing or invalid else 0
        setup(ENV, raw, values, meta)
        return 0
    except (OSError, ValueError, UnicodeError) as error:
        print("Finance gateway setup refused: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
