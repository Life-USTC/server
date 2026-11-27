from __future__ import annotations

import hmac
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from runtime import DELIVERY, ImportQueue, delivery_metadata, signature

MAX_BODY_BYTES = 16_384


class Handler(BaseHTTPRequestHandler):
    server_version = "StaticImportWebhook/1"
    queue: ImportQueue
    secret: str
    allowed_host: str

    def json_response(self, status: int, value: dict) -> None:
        body = json.dumps(value, sort_keys=True).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path != "/healthz":
            self.json_response(404, {"error": "not_found"})
            return
        self.json_response(200, {"status": "ok", "deliveries": self.queue.counts()})

    def do_POST(self) -> None:
        if self.path != "/api/static-import":
            self.json_response(404, {"error": "not_found"})
            return
        try:
            timestamp = self.headers["X-Static-Import-Timestamp"]
            delivery = self.headers["X-Static-Import-Delivery"]
            supplied = self.headers["X-Static-Import-Signature"]
            if not DELIVERY.fullmatch(delivery):
                raise ValueError("invalid delivery")
            if abs(time.time() - int(timestamp)) > 300:
                raise ValueError("stale delivery")
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY_BYTES:
                self.json_response(413, {"error": "invalid_content_length"})
                return
            body = self.rfile.read(length)
            expected = signature(self.secret, timestamp, delivery, body)
            if not hmac.compare_digest(supplied, expected):
                self.json_response(401, {"error": "invalid_signature"})
                return
            value = json.loads(body)
            url, sha256, generated_at = delivery_metadata(
                value, allowed_host=self.allowed_host
            )
            status = self.queue.enqueue(delivery, url, sha256, generated_at)
            self.json_response(202, {"status": status, "deliveryId": delivery})
        except (KeyError, ValueError, TypeError, json.JSONDecodeError):
            self.json_response(400, {"error": "invalid_delivery"})

    def log_message(self, format: str, *args) -> None:
        print(f"webhook: {format % args}", flush=True)


def main() -> None:
    Handler.queue = ImportQueue(os.environ.get("STATIC_IMPORT_QUEUE_DIR", "/data"))
    Handler.secret = os.environ["STATIC_IMPORT_WEBHOOK_SECRET"]
    Handler.allowed_host = os.environ.get(
        "STATIC_IMPORT_ALLOWED_HOST", "static.life-ustc.tiankaima.dev"
    )
    server = ThreadingHTTPServer(("0.0.0.0", 8787), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
