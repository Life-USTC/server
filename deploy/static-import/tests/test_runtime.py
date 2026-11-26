from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1]))

from runtime import ImportQueue, delivery_metadata, signature
from worker import prune_cache, run_import, run_once


class RuntimeTests(unittest.TestCase):
    def test_signature_and_delivery_validation(self) -> None:
        body = b'{"generatedAt":"2026-11-26T00:00:00Z"}'
        self.assertEqual(
            signature("secret", "100", "delivery-123456", body),
            signature("secret", "100", "delivery-123456", body),
        )
        self.assertNotEqual(
            signature("secret", "100", "delivery-123456", body),
            signature("other", "100", "delivery-123456", body),
        )
        value = {
            "manifestUrl": "https://static.life-ustc.tiankaima.dev/snapshot-manifest.json",
            "sha256": "a" * 64,
            "generatedAt": "2026-11-26T00:00:00Z",
        }
        self.assertEqual(
            delivery_metadata(value, allowed_host="static.life-ustc.tiankaima.dev")[1],
            "a" * 64,
        )
        value["manifestUrl"] = "https://example.test/snapshot-manifest.json"
        with self.assertRaises(ValueError):
            delivery_metadata(value, allowed_host="static.life-ustc.tiankaima.dev")

    def test_queue_is_durable_and_retries_before_terminal_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            queue = ImportQueue(directory)
            delivery = "delivery-123456789"
            self.assertEqual(
                queue.enqueue(
                    delivery,
                    "https://static.life-ustc.tiankaima.dev/snapshot-manifest.json",
                    "a" * 64,
                    "2026-11-26T00:00:00Z",
                ),
                "queued",
            )
            claimed = queue.claim()
            self.assertEqual(claimed["id"], delivery)
            queue.finish(delivery, error="RuntimeError")
            self.assertEqual(queue.counts(), {"pending": 1})
            self.assertIsNone(queue.claim())
            with queue._connect() as db:
                db.execute("UPDATE deliveries SET next_attempt_at=0")
            claimed = queue.claim()
            self.assertEqual(claimed["id"], delivery)
            queue.finish(delivery, report={})
            self.assertEqual(queue.counts(), {"succeeded": 1})

    def test_worker_checks_signed_identity_and_reports_success(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            queue = ImportQueue(directory)
            delivery = "delivery-123456789"
            queue.enqueue(
                delivery,
                "https://static.life-ustc.tiankaima.dev/snapshot-manifest.json",
                "a" * 64,
                "2026-11-26T00:00:00Z",
            )
            report = {
                "snapshot": {
                    "sha256": "a" * 64,
                    "generatedAt": "2026-11-26T00:00:00Z",
                }
            }
            with patch("worker.run_import", return_value=report):
                self.assertEqual(
                    run_once(
                        queue,
                        "https://static.life-ustc.tiankaima.dev/snapshot-manifest.json",
                    ),
                    "succeeded",
                )
            self.assertEqual(queue.counts(), {"succeeded": 1})

    def test_import_uses_real_entrypoint_and_reads_stats(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            environment = {"STATIC_IMPORT_QUEUE_DIR": directory}

            def completed(*_args, **kwargs):
                report = kwargs["env"]["STATIC_LOADER_STATS_FILE"]
                Path(report).write_text(json.dumps({"outcome": "unchanged"}))
                return type(
                    "Result", (), {"returncode": 0, "stdout": "", "stderr": ""}
                )()

            with (
                patch.dict(os.environ, environment, clear=True),
                patch("worker.subprocess.run", side_effect=completed) as process,
            ):
                self.assertEqual(
                    run_import(
                        "https://static.life-ustc.tiankaima.dev/snapshot-manifest.json"
                    ),
                    {"outcome": "unchanged"},
                )
                self.assertEqual(
                    process.call_args.args[0], ["scripts/load-static-sqlite.sh"]
                )

    def test_cache_pruning_retains_newest_files_within_bound(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for index in range(3):
                path = root / str(index)
                path.write_bytes(b"x" * 10)
                os.utime(path, (index, index))
            prune_cache(root, maximum_bytes=15)
            self.assertEqual({path.name for path in root.iterdir()}, {"2"})


if __name__ == "__main__":
    unittest.main()
