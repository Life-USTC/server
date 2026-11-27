from __future__ import annotations

import json
import sys
import tempfile
import threading
import time
import unittest
import uuid
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).parents[1]))

from runtime import ImportQueue, signature
from webhook import Handler


class WebhookTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = self.enterContext(tempfile.TemporaryDirectory())
        Handler.queue = ImportQueue(self.directory)
        Handler.secret = "test-secret"
        Handler.allowed_host = "static.life-ustc.tiankaima.dev"
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.origin = f"http://127.0.0.1:{self.server.server_port}"

        def cleanup() -> None:
            self.server.shutdown()
            self.server.server_close()
            self.thread.join()

        self.addCleanup(cleanup)

    def post(self, body: bytes, *, secret: str = "test-secret") -> dict:
        delivery = uuid.uuid4().hex
        timestamp = str(int(time.time()))
        request = Request(
            self.origin + "/api/static-import",
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-Static-Import-Timestamp": timestamp,
                "X-Static-Import-Delivery": delivery,
                "X-Static-Import-Signature": signature(
                    secret, timestamp, delivery, body
                ),
            },
        )
        with urlopen(request, timeout=3) as response:
            self.assertEqual(response.status, 202)
            return json.load(response)

    def test_signed_delivery_is_queued_and_health_has_no_secret(self) -> None:
        body = json.dumps(
            {
                "manifestUrl": "https://static.life-ustc.tiankaima.dev/snapshot-manifest.json",
                "sha256": "a" * 64,
                "generatedAt": "2026-11-26T00:00:00Z",
            }
        ).encode()
        result = self.post(body)
        self.assertEqual(result["status"], "queued")
        with urlopen(self.origin + "/healthz", timeout=3) as response:
            health = json.load(response)
        self.assertEqual(health["deliveries"], {"pending": 1})
        self.assertNotIn("test-secret", json.dumps(health))

    def test_invalid_signature_is_rejected_without_queue_write(self) -> None:
        with self.assertRaises(HTTPError) as raised:
            self.post(b"{}", secret="wrong")
        self.assertEqual(raised.exception.code, 401)
        raised.exception.close()
        self.assertEqual(Handler.queue.counts(), {})


if __name__ == "__main__":
    unittest.main()
