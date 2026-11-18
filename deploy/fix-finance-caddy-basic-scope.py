#!/usr/bin/env python3
"""One password for finance: remove outer Basic only on the finance host and
preserve /finance-api paths on the owner-session gateway. Never edit Screening40.
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
    block = original[opening + 1:closing]
    if "/opt/finances-2027/site" not in block:
        raise ValueError("Unexpected finance static root")
    lines = block.splitlines(keepends=True)
    depth = 1
    auth_start = auth_end = auth_depth = None
    route_index = None
    proxy_found = False
    for index, line in enumerate(lines):
        code = line.partition("#")[0].strip()
        parts = code.split()
        if depth == 1 and parts and parts[0] in ("basic_auth", "basicauth"):
            if auth_start is not None or not code.endswith("{"):
                raise ValueError("Unexpected finance Basic auth layout")
            auth_start, auth_depth = index, depth
        if depth == 1 and parts and parts[0] in ("handle_path", "handle") and "/finance-api/*" in parts:
            if route_index is not None:
                raise ValueError("Multiple finance API routes")
            if parts[:2] != ["handle_path", "/finance-api/*"] or not code.endswith("{"):
                raise ValueError("Expected handle_path /finance-api/*")
            route_index = index
        if route_index is not None and depth >= 2 and parts and parts[0] == "reverse_proxy" and "127.0.0.1:8092" in parts:
            proxy_found = True
        depth += code.count("{") - code.count("}")
        if auth_start is not None and auth_end is None and depth == auth_depth:
            auth_end = index + 1
    if depth != 1 or auth_start is None or auth_end is None:
        raise ValueError("Expected one complete finance Basic auth block")
    if route_index is None or not proxy_found:
        raise ValueError("Expected existing finance gateway path/proxy")
    if auth_start <= route_index < auth_end:
        raise ValueError("Finance API route nested in Basic auth")
    lines[route_index] = lines[route_index].replace(
        "handle_path /finance-api/*", "handle /finance-api/*", 1
    )
    del lines[auth_start:auth_end]
    return original[:opening + 1] + "".join(lines) + original[closing:]


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
    # The login page is public; personal finance records remain locked behind
    # the existing owner-session gateway. Never send real passwords in probes.
    code, head, _ = curl("/")
    if code != 200 or "www-authenticate: basic" in head:
        raise ValueError("Finance login page was not accessible without Caddy Basic")
    code, head, body = curl("/finance-api/session")
    try:
        session = json.loads(body)
    except ValueError as error:
        raise ValueError("Finance browser session returned no JSON") from error
    if code != 200 or session != {"authenticated": False} or "www-authenticate: basic" in head:
        raise ValueError("Finance API session did not reach owner gateway")
    code, head, _ = curl("/finance-api/obligations")
    if code != 401 or "www-authenticate: basic" in head:
        raise ValueError("Finance records were not protected by owner session")
    code, head, _ = curl(
        "/finance-api/login", method="POST",
        headers=(("Origin", "https://" + FINANCE_HOST),
                 ("Content-Type", "application/json")), data="{"
    )
    if code != 400 or "www-authenticate: basic" in head:
        raise ValueError("Finance login POST did not reach owner gateway")
    print("FINANCE_SINGLE_PASSWORD_PASS: page 200, session 200, records 401, login 400")


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
    print("FINANCE_SINGLE_PASSWORD_APPLIED: finance host only; other sites unchanged")


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
                print("FINANCE_SINGLE_PASSWORD_CHECK_PASS, no server changes")
            return 0
        apply(original, changed)
        return 0
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        print("Finance-only routing fix refused: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
