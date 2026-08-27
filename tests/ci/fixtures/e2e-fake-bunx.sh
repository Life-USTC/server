#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "playwright" ]]; then
  mkdir -p "${E2E_WORKER_ARTIFACT_DIR:-playwright-report/worker}"
  echo "kj/async-io-unix.c++:186 Broken pipe" >> \
    "${E2E_WORKER_ARTIFACT_DIR:-playwright-report/worker}/wrangler.log"
  echo "deterministic Playwright assertion failed" >&2
  exit 1
fi

if [[ "${1:-}" != "wrangler" ]]; then
  echo "fake bunx only supports Wrangler and Playwright in this regression test" >&2
  exit 1
fi

exec bun -e '
  const port = Number(process.env.E2E_PORT);
  Bun.serve({
    port,
    fetch() {
      return new Response("ok\n", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    },
  });
  await new Promise(() => {});
'
