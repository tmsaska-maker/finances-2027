#!/usr/bin/env python3
"""Finance-only Caddy Basic scope fix. Run on the existing Lightsail host.

Public finance UI stays behind Caddy Basic auth. Only /finance-api/* bypasses
that outer prompt; every real finance endpoint is protected by the existing
cookie-session gateway on localhost:8092. Never change Screening40 routes.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

CADDYFILE = Path("/etc/caddy/Caddyfile")
FINANCE_HOST = "finances.screening40.com.ua"
GATEWAY = "http://127.0.0.1:8092/finance-api/session"
MATCHER = "@finance_ui_basic_only"
SITE_RE = re.compile(r"(?m)^[ \t]*finances\.screening40\.com\.ua[ \t]*\{[ \t]*(?:#.*)?$")
BASIC_RE = re.compile(r"^([ \t]*)(basic_auth|basicauth)([ \t]+[^\n{]*)?([ \t]*\{[ \t]*(?:#.*)?)$")


def site_bounds(text):
    matches = list(SITE_RE.finditer(text))
    if len(matches) != 1:
        raise ValueError("Expected exactly one finance site block; refusing shared Caddy edit")
    opening = text.index("{", matches[0].start())
    depth = 0
    for i in range(opening, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return opening, i
    raise ValueError("Unbalanced finance site block")


def scoped_config(original):
    opening, closing = site_bounds(original)
    block = original[opening + 1 : closing]
    if "/opt/finances-2027/site" not in block:
        raise ValueError("Unexpected finance static root")
    if "/finance-api/*" not in block or "127.0.0.1:8092" not in block:
        raise ValueError("Expected existing finance API reverse proxy to 8092")
    if MATCHER in block:
        raise ValueError("Finance Basic matcher already exists; no mutation necessary")
    lines = block.splitlines(keepends=True)
    depth = 1
    found = []
    for index, line in enumerate(lines):
        # Only support a top-level Basic-auth block. Never rewrite imported snippets
        # or auth blocks inside a nested route.
        match = BASIC_RE.match(line.rstrip("\r\n"))
        if match and depth == 1:
            arguments = (match.group(3) or "").strip().split()
            if arguments and (arguments[0].startswith(("@", "/")) or arguments[0] == "*"):
                raise ValueError("Existing Basic authentication has a matcher; refusing guess")
            found.append((index, match))
        no_comment = line.partition("#")[0]
        depth += no_comment.count("{") - no_comment.count("}")
    if len(found) != 1:
        raise ValueError("Expected exactly one direct Basic auth block in finance site; refusing guess")
    index, match = found[0]
    indent, keyword = match.group(1), match.group(2)
    args = match.group(3) or ""
    suffix = match.group(4)
    original_line = lines[index]
    newline = "\r\n" if original_line.endswith("\r\n") else "\n"
    matcher_block = (
        indent + MATCHER + " {\n"
        + indent + "    not path /finance-api/*\n"
        + indent + "}\n"
    )
    lines[index] = (
        matcher_block + indent + keyword + " " + MATCHER
        + args + suffix + newline
    )
    candidate = original[:opening + 1] + "".join(lines) + original[closing:]
    if candidate[:opening + 1] != original[:opening + 1]:
        raise ValueError("Prefix outside finance block changed")
    if candidate.endswith(original[closing:]) is False:
        raise ValueError("Suffix outside finance block changed")
    return candidate


def run(command, timeout=12):
    return subprocess.run(command, capture_output=True, text=True, timeout=timeout)


def curl(path, method="GET", headers=(), data=None):
    command = [
        "curl", "--silent", "--show-error", "--max-time", "8",
        "--resolve", FINANCE_HOST + ":443:127.0.0.1",
        "--dump-header", "-", "--output", "-",
        "--request", method,
    ]
    for name, value in headers:
        command += ["--header", name + ": " + value]
    if data is not None:
        command += ["--data-binary", data]
    command.append("https://" + FINANCE_HOST + path)
    response = run(command)
    if response.returncode:
        raise ValueError("Local HTTPS finance probe unavailable")
    text = response.stdout.replace("\r\n", "\n")
    chunks = re.split(r"\n\n", text, maxsplit=1)
    if len(chunks) != 2:
        raise ValueError("Unexpected HTTPS probe response")
    head, body = chunks
    statuses = re.findall(r"(?im)^HTTP/(?:1(?:\.0|\.1)?|2|3)\s+(\d{3})[^\n]*$", head)
    if not statuses:
        raise ValueError("HTTPS probe missing HTTP status")
    return int(statuses[-1]), head.lower(), body


def verify_live():
    # Page remains gated by the ORIGINAL outer Caddy Basic credentials.
    code, head, _ = curl("/")
    if code != 401 or 'www-authenticate: basic realm="restricted"' not in head:
        raise ValueError("Static finance UI is no longer protected by Caddy Basic auth")
    # API anonymous session is *designed* to be reachable without Basic auth,
    # but it cannot return financial data without its separate owner session.
    code, head, body = curl("/finance-api/session")
    try:
        session = json.loads(body)
    except ValueError as error:
        raise ValueError("Finance gateway did not return valid JSON") from error
    if code != 200 or session != {"authenticated": False}:
        raise ValueError("Finance anonymous session route did not reach gateway")
    # Malformed login payload validates the POST route, without guessing or
    # consuming password attempts. No Basic auth challenge should occur here.
    code, head, body = curl(
        "/finance-api/login",
        method="POST",
        headers=(
            ("Origin", "https://" + FINANCE_HOST),
            ("Content-Type", "application/json"),
        ),
        data="{",
    )
    if code != 400 or "www-authenticate: basic" in head:
        raise ValueError("Finance login POST did not reach private gateway")
    print("Finance routing PASS: static Basic 401, gateway session 200, gateway login 400")


def apply(original, candidate):
    with tempfile.TemporaryDirectory(prefix="finance-caddy-", dir="/tmp") as stage:
        file = Path(stage) / "Caddyfile"
        file.write_text(candidate, encoding="utf-8")
        os.chmod(file, 0o600)
        valid = run(["caddy", "validate", "--config", str(file), "--adapter", "caddyfile"])
        if valid.returncode:
            raise ValueError("Caddy candidate validation failed; live config unchanged")
        # Reload candidate in memory, retain old config on disk until success.
        reload_candidate = run(["caddy", "reload", "--config", str(file), "--adapter", "caddyfile"])
        if reload_candidate.returncode:
            raise ValueError("Caddy candidate reload failed; live config file unchanged")
        try:
            verify_live()
            # Preserve existing ownership and mode; no backup or clone made.
            stat = CADDYFILE.stat()
            fd, candidate_path = tempfile.mkstemp(prefix=".finance-caddy-", dir=CADDYFILE.parent)
            try:
                os.fchmod(fd, stat.st_mode & 0o777)
                os.fchown(fd, stat.st_uid, stat.st_gid)
                with os.fdopen(fd, "w", encoding="utf-8") as output:
                    output.write(candidate)
                    output.flush()
                    os.fsync(output.fileno())
                os.replace(candidate_path, CADDYFILE)
            finally:
                if os.path.exists(candidate_path):
                    os.unlink(candidate_path)
        except Exception:
            # Previous Caddyfile remained unchanged; restore active config.
            rollback = run(["caddy", "reload", "--config", str(CADDYFILE), "--adapter", "caddyfile"])
            if rollback.returncode:
                raise ValueError("Finance probe failed AND original Caddy reload failed")
            raise
    print("Finance Caddy routing updated in place; other sites unchanged")


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--check", action="store_true")
    group.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    try:
        if os.geteuid() != 0:
            raise ValueError("Use sudo on existing Lightsail host")
        if CADDYFILE.is_symlink() or not CADDYFILE.is_file():
            raise ValueError("Expected existing regular Caddyfile")
        original = CADDYFILE.read_text(encoding="utf-8")
        changed = scoped_config(original)
        # In --check mode validate the candidate but do not reload/write.
        if args.check:
            with tempfile.TemporaryDirectory(prefix="finance-caddy-", dir="/tmp") as stage:
                file = Path(stage) / "Caddyfile"
                file.write_text(changed, encoding="utf-8")
                os.chmod(file, 0o600)
                result = run(["caddy", "validate", "--config", str(file), "--adapter", "caddyfile"])
                if result.returncode:
                    raise ValueError("Finance-only Caddy candidate is not valid")
                print("Finance-only Caddy candidate PASS, no server changes")
            return 0
        apply(original, changed)
        return 0
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        print("Finance-only routing fix refused: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
