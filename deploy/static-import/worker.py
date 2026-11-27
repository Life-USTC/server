from __future__ import annotations

import json
import os
import signal
import sqlite3
import subprocess
import time
from pathlib import Path

from runtime import ImportQueue

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPECTED_ERRORS = (
    OSError,
    RuntimeError,
    ValueError,
    TypeError,
    KeyError,
    sqlite3.Error,
    subprocess.SubprocessError,
    json.JSONDecodeError,
)


def prune_cache(directory: Path, maximum_bytes: int = 2 * 1024**3) -> None:
    if not directory.exists():
        return
    files = sorted(
        (path for path in directory.iterdir() if path.is_file()),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    retained = 0
    for path in files:
        size = path.stat().st_size
        if retained + size <= maximum_bytes:
            retained += size
        else:
            path.unlink()


def run_import(manifest: str, delivery: str | None = None) -> dict:
    queue_dir = Path(os.environ.get("STATIC_IMPORT_QUEUE_DIR", "/data"))
    report_path = queue_dir / f"report-{delivery or 'reconcile'}.json"
    environment = os.environ.copy()
    environment.update(
        {
            "STATIC_SNAPSHOT_MANIFEST_URL": manifest,
            "STATIC_SNAPSHOT_CACHE_DIR": "/cache",
            "STATIC_LOADER_STATS_FILE": str(report_path),
            "STATIC_LOADER_DRY_RUN": "false",
        }
    )
    prune_cache(Path("/cache"))
    report_path.unlink(missing_ok=True)
    try:
        result = subprocess.run(
            ["scripts/load-static-sqlite.sh"],
            cwd=REPO_ROOT,
            env=environment,
            capture_output=True,
            text=True,
            timeout=2700,
            check=False,
        )
        if result.stdout:
            print(result.stdout, end="", flush=True)
        if result.stderr:
            print(result.stderr, end="", flush=True)
        if result.returncode != 0:
            raise RuntimeError(f"static importer exited with {result.returncode}")
        report = json.loads(report_path.read_text(encoding="utf-8"))
        if delivery and (
            report.get("snapshot", {}).get("sha256") is None
            or report.get("snapshot", {}).get("generatedAt") is None
        ):
            raise RuntimeError("import report is missing snapshot identity")
        return report
    finally:
        report_path.unlink(missing_ok=True)


def expected_identity_matches(delivery, report: dict) -> bool:
    snapshot = report.get("snapshot", {})
    return (
        snapshot.get("sha256") == delivery["snapshot_sha256"]
        and snapshot.get("generatedAt") == delivery["generated_at"]
    )


def run_once(queue: ImportQueue, manifest: str, *, reconcile: bool = True) -> str:
    delivery = queue.claim()
    if delivery is None:
        if not reconcile:
            return "idle"
        run_import(manifest)
        return "reconciled"
    try:
        report = run_import(delivery["manifest_url"], delivery["id"])
        if not expected_identity_matches(delivery, report):
            raise RuntimeError("imported snapshot does not match the signed delivery")
    except EXPECTED_ERRORS as error:
        queue.finish(delivery["id"], error=type(error).__name__)
        return "failed"
    queue.finish(delivery["id"], report=report)
    return "succeeded"


def main() -> None:
    queue = ImportQueue(os.environ.get("STATIC_IMPORT_QUEUE_DIR", "/data"))
    queue.recover_interrupted()
    manifest = os.environ["STATIC_SNAPSHOT_MANIFEST_URL"]
    stopped = False

    def stop(_signum, _frame) -> None:
        nonlocal stopped
        stopped = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    next_reconcile = 0.0
    while not stopped:
        try:
            outcome = run_once(
                queue,
                manifest,
                reconcile=time.time() >= next_reconcile,
            )
            if outcome != "idle":
                next_reconcile = time.time() + 300
            if outcome != "succeeded":
                print(f"static import: {outcome}", flush=True)
        except EXPECTED_ERRORS as error:
            next_reconcile = time.time() + 300
            print(f"static import: {type(error).__name__}", flush=True)
        if stopped:
            break
        time.sleep(5)


if __name__ == "__main__":
    main()
