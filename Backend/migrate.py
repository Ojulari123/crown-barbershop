#!/usr/bin/env python3
"""Crown schema migration runner.

Applies the SQL files in ``migrations/`` in filename order and records each one in
``schema_migrations`` (filename + SHA-256), so the state of any database is knowable.
The app never creates or alters tables itself.

    python migrate.py status   # applied / pending / drifted; exit 2 if not up to date
    python migrate.py up       # apply everything pending, one transaction per file
    python migrate.py verify   # checksum check only (CI); exit 2 on drift or pending

Connection: ``$DATABASE_URL``, else ``DATABASE_URL`` from ``Backend/.env``. It does not
import config.py, so it runs without the app's secrets.

Rules: name files ``YYYY-MM-DD_name.sql``; never edit an applied file (write a new one);
no BEGIN/COMMIT in files, the runner owns the transaction.
"""

from __future__ import annotations

import argparse
import getpass
import hashlib
import os
import sys
import time
from pathlib import Path

import psycopg2
from dotenv import dotenv_values

HERE = Path(__file__).resolve().parent
MIGRATIONS_DIR = HERE / "migrations"

# Fixed key so two concurrent runners (two deploys, a human and CI) serialise.
ADVISORY_LOCK_KEY = 7_311_904_226

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    varchar(255) PRIMARY KEY,
    checksum    varchar(64)  NOT NULL,
    applied_at  timestamptz  NOT NULL DEFAULT now(),
    applied_by  varchar(100),
    duration_ms integer
);
"""


def database_url() -> str:
    url = os.environ.get("DATABASE_URL") or dotenv_values(HERE / ".env").get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL is not set (env or Backend/.env)")
    return url


def migration_files() -> list[Path]:
    return sorted(MIGRATIONS_DIR.glob("*.sql"), key=lambda p: p.name)


def checksum(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def applied_map(conn) -> dict[str, str]:
    with conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.schema_migrations')")
        if cur.fetchone()[0] is None:
            return {}
        cur.execute("SELECT filename, checksum FROM schema_migrations")
        return dict(cur.fetchall())


def classify(files: list[Path], applied: dict[str, str]):
    pending = [p for p in files if p.name not in applied]
    drifted = [p.name for p in files if p.name in applied and applied[p.name] != checksum(p)]
    orphaned = sorted(set(applied) - {p.name for p in files})
    return pending, drifted, orphaned


def target(url: str) -> str:
    # Never print the password.
    tail = url.split("@", 1)[-1]
    return tail.split("?", 1)[0]


def cmd_status(conn, url: str) -> int:
    files = migration_files()
    applied = applied_map(conn)
    pending, drifted, orphaned = classify(files, applied)
    print(f"target: {target(url)}")
    print(f"{len(files)} file(s) on disk, {len(applied)} applied")
    for p in files:
        state = "PENDING" if p.name not in applied else ("DRIFTED" if p.name in drifted else "applied")
        print(f"  {state:8} {p.name}")
    for name in orphaned:
        print(f"  ORPHANED {name} (applied but missing on disk)")
    if not (pending or drifted or orphaned):
        print("Up to date.")
        return 0
    return 2


def cmd_verify(conn, url: str) -> int:
    pending, drifted, orphaned = classify(migration_files(), applied_map(conn))
    if pending or drifted or orphaned:
        print(f"FAIL: {len(pending)} pending, {len(drifted)} drifted, {len(orphaned)} orphaned")
        return 2
    print("OK: all migrations applied, checksums match")
    return 0


def cmd_up(conn, url: str) -> int:
    print(f"target: {target(url)}")
    with conn.cursor() as cur:
        cur.execute(CREATE_TABLE_SQL)
        cur.execute("SELECT pg_advisory_lock(%s)", (ADVISORY_LOCK_KEY,))
    conn.commit()
    pending, drifted, _ = classify(migration_files(), applied_map(conn))
    if drifted:
        print("Refusing to run: applied migrations changed on disk: " + ", ".join(drifted))
        return 1
    if not pending:
        print("Nothing to apply, up to date.")
        return 0
    for path in pending:
        started = time.monotonic()
        try:
            with conn.cursor() as cur:
                cur.execute(path.read_text(encoding="utf-8"))
                cur.execute(
                    "INSERT INTO schema_migrations (filename, checksum, applied_by, duration_ms) "
                    "VALUES (%s, %s, %s, %s)",
                    (path.name, checksum(path), getpass.getuser()[:100],
                     int((time.monotonic() - started) * 1000)),
                )
            conn.commit()
        except Exception as exc:
            conn.rollback()
            print(f"  FAILED   {path.name}: {exc}".rstrip())
            return 1
        print(f"  applied  {path.name}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Crown SQL migration runner")
    parser.add_argument("command", choices=["status", "up", "verify"])
    args = parser.parse_args()
    url = database_url()
    try:
        conn = psycopg2.connect(url)
    except Exception as exc:
        sys.exit(f"Could not connect: {exc}")
    try:
        return {"status": cmd_status, "up": cmd_up, "verify": cmd_verify}[args.command](conn, url)
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
