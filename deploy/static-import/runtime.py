from __future__ import annotations

import hashlib
import hmac
import json
import re
import sqlite3
import threading
import time
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit

SHA256 = re.compile(r"^[0-9a-f]{64}$")
DELIVERY = re.compile(r"^[A-Za-z0-9-]{16,80}$")


def manifest_url(value: str, *, allowed_host: str) -> str:
    parsed = urlsplit(value)
    if (
        parsed.scheme != "https"
        or parsed.hostname != allowed_host
        or parsed.username
        or parsed.password
        or not parsed.path.endswith("/snapshot-manifest.json")
    ):
        raise ValueError("manifest URL is outside the configured static origin")
    return value


def delivery_metadata(value: object, *, allowed_host: str) -> tuple[str, str, str]:
    if not isinstance(value, dict):
        raise TypeError("delivery must be a JSON object")
    url = manifest_url(str(value.get("manifestUrl", "")), allowed_host=allowed_host)
    sha256 = str(value.get("sha256", ""))
    generated_at = str(value.get("generatedAt", ""))
    if not SHA256.fullmatch(sha256):
        raise ValueError("invalid snapshot SHA-256")
    datetime.fromisoformat(generated_at).astimezone(UTC)
    return url, sha256, generated_at


def signature(secret: str, timestamp: str, delivery: str, body: bytes) -> str:
    return hmac.new(
        secret.encode(), f"{timestamp}.{delivery}.".encode() + body, hashlib.sha256
    ).hexdigest()


class ImportQueue:
    def __init__(self, directory: str | Path) -> None:
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.path = self.directory / "queue.sqlite"
        self._lock = threading.RLock()
        with self._connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("""
                CREATE TABLE IF NOT EXISTS deliveries(
                    id TEXT PRIMARY KEY,
                    manifest_url TEXT NOT NULL,
                    snapshot_sha256 TEXT NOT NULL,
                    generated_at TEXT NOT NULL,
                    status TEXT NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    next_attempt_at REAL NOT NULL DEFAULT 0,
                    last_error TEXT NOT NULL DEFAULT '',
                    report_json TEXT NOT NULL DEFAULT '',
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                )
            """)

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=30)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            connection.close()

    def enqueue(
        self,
        delivery: str,
        manifest: str,
        snapshot_sha256: str,
        generated_at: str,
    ) -> str:
        if not DELIVERY.fullmatch(delivery):
            raise ValueError("invalid delivery ID")
        now = time.time()
        with self._lock, self._connect() as db:
            db.execute(
                """INSERT OR IGNORE INTO deliveries(
                    id, manifest_url, snapshot_sha256, generated_at,
                    status, created_at, updated_at
                ) VALUES(?, ?, ?, ?, 'pending', ?, ?)""",
                (delivery, manifest, snapshot_sha256, generated_at, now, now),
            )
            row = db.execute(
                "SELECT status FROM deliveries WHERE id=?", (delivery,)
            ).fetchone()
            if row is None:
                raise RuntimeError("delivery was not persisted")
            return "queued" if row["status"] == "pending" else "duplicate"

    def claim(self) -> sqlite3.Row | None:
        now = time.time()
        with self._lock, self._connect() as db:
            row = db.execute(
                """SELECT * FROM deliveries
                WHERE status='pending' AND next_attempt_at<=?
                ORDER BY created_at, id LIMIT 1""",
                (now,),
            ).fetchone()
            if row is None:
                return None
            changed = db.execute(
                """UPDATE deliveries SET status='running', attempts=attempts+1,
                updated_at=? WHERE id=? AND status='pending'""",
                (now, row["id"]),
            ).rowcount
            if changed != 1:
                return None
            return row

    def recover_interrupted(self) -> None:
        with self._lock, self._connect() as db:
            db.execute(
                "UPDATE deliveries SET status='pending', next_attempt_at=0 WHERE status='running'"
            )

    def finish(
        self, delivery: str, error: str = "", report: dict | None = None
    ) -> None:
        now = time.time()
        with self._lock, self._connect() as db:
            row = db.execute(
                "SELECT attempts FROM deliveries WHERE id=? AND status='running'",
                (delivery,),
            ).fetchone()
            if row is None:
                raise RuntimeError("delivery is not running")
            retry = bool(error) and row["attempts"] < 5
            status = "pending" if retry else "failed" if error else "succeeded"
            delay = min(900, 2 ** row["attempts"] * 30) if retry else 0
            db.execute(
                """UPDATE deliveries SET status=?, next_attempt_at=?, last_error=?,
                report_json=?, updated_at=? WHERE id=?""",
                (
                    status,
                    now + delay,
                    error[:500],
                    json.dumps(report or {}, sort_keys=True),
                    now,
                    delivery,
                ),
            )

    def counts(self) -> dict[str, int]:
        with self._lock, self._connect() as db:
            return {
                row["status"]: row["count"]
                for row in db.execute(
                    "SELECT status, COUNT(*) AS count FROM deliveries GROUP BY status"
                )
            }
