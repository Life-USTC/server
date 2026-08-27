#!/usr/bin/env bash
# Run request-id response ownership checks inside the real Wrangler/workerd
# runtime. This covers platform behavior that Node/Bun's Response polyfills do
# not reproduce, including immutable redirect headers and Workers extensions.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

for command in bun curl node grep; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "$command is required" >&2
    exit 1
  }
done

# The production helper uses the project's `@` alias, which SvelteKit writes
# to `.svelte-kit/tsconfig.json`. Keep this fixture runnable from a fresh
# checkout instead of relying on an earlier CI phase having generated it.
bun run svelte:sync >/dev/null

temp_dir="$(mktemp -d)"
worker_pid=""
cleanup() {
  if [[ -n "$worker_pid" ]] && kill -0 "$worker_pid" >/dev/null 2>&1; then
    kill -TERM "$worker_pid" >/dev/null 2>&1 || true
    wait "$worker_pid" >/dev/null 2>&1 || true
  fi
  rm -rf "$temp_dir"
}
trap cleanup EXIT

port="$(bun -e '
  const listener = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: { data() {} },
  });
  console.log(listener.port);
  listener.stop(true);
')"
base_url="http://127.0.0.1:${port}"

bunx wrangler dev \
  --config wrangler.observability.jsonc \
  --ip 127.0.0.1 \
  --port "$port" \
  --local >"$temp_dir/wrangler.log" 2>&1 &
worker_pid="$!"

for _ in $(seq 1 60); do
  if curl --silent --show-error --fail --max-time 2 --noproxy '*' \
    "$base_url/redirect" >"$temp_dir/redirect.json" 2>/dev/null; then
    break
  fi
  if ! kill -0 "$worker_pid" >/dev/null 2>&1; then
    sed -n '1,240p' "$temp_dir/wrangler.log" >&2
    exit 1
  fi
  sleep 1
done

test -s "$temp_dir/redirect.json" || {
  echo "platform Worker did not become ready" >&2
  sed -n '1,240p' "$temp_dir/wrangler.log" >&2
  exit 1
}

fetch_json() {
  local path="$1"
  local output="$2"
  curl --silent --show-error --fail --max-time 10 --noproxy '*' \
    "$base_url/$path" >"$output"
}

fetch_json metadata "$temp_dir/metadata.json"
fetch_json websocket "$temp_dir/websocket.json"
fetch_json locked "$temp_dir/locked.json"
fetch_json disturbed "$temp_dir/disturbed.json"
fetch_json non-immutable "$temp_dir/non-immutable.json"

node - "$temp_dir/redirect.json" "$temp_dir/metadata.json" \
  "$temp_dir/websocket.json" "$temp_dir/locked.json" \
  "$temp_dir/disturbed.json" "$temp_dir/non-immutable.json" <<'NODE'
const fs = require("node:fs");
const [redirect, metadata, websocket, locked, disturbed, nonImmutable] =
  process.argv.slice(2).map((path) => JSON.parse(fs.readFileSync(path, "utf8")));

if (redirect.immutableError !== "TypeError:Can't modify immutable headers.") {
  throw new Error(`workerd did not expose immutable headers: ${redirect.immutableError}`);
}
if (
  redirect.same ||
  redirect.status !== 302 ||
  redirect.statusText !== "Found" ||
  redirect.location !== "https://example.test/target" ||
  redirect.requestId !== "66666666-6666-4666-8666-666666666666"
) {
  throw new Error(`redirect semantics changed: ${JSON.stringify(redirect)}`);
}
if (
  metadata.body !== "streamed" ||
  !metadata.bodySame ||
  metadata.status !== 206 ||
  metadata.statusText !== "Partial Content" ||
  metadata.requestId !== "11111111-1111-4111-8111-111111111111" ||
  JSON.stringify(metadata.cookies) !== JSON.stringify(["session=one", "theme=dark"]) ||
  metadata.cf?.cacheStatus !== "HIT" ||
  metadata.contentEncoding !== "gzip"
) {
  throw new Error(`metadata semantics changed: ${JSON.stringify(metadata)}`);
}
if (
  websocket.status !== 101 ||
  !websocket.hasWebSocket ||
  websocket.requestId !== "77777777-7777-4777-8777-777777777777"
) {
  throw new Error(`WebSocket semantics changed: ${JSON.stringify(websocket)}`);
}
if (locked.error !== "TypeError:Response body is locked or disturbed.") {
  throw new Error(`locked body was not rejected: ${locked.error}`);
}
if (disturbed.error !== "TypeError:Response body is locked or disturbed.") {
  throw new Error(`disturbed body was not rejected: ${disturbed.error}`);
}
if (nonImmutable.error !== "TypeError:header sink unavailable") {
  throw new Error(`non-immutable TypeError was misclassified: ${nonImmutable.error}`);
}
NODE

curl --silent --show-error --fail --max-time 10 --noproxy '*' \
  --compressed -D "$temp_dir/encoding.headers" \
  "$base_url/encoding" >"$temp_dir/encoding.body"
test "$(<"$temp_dir/encoding.body")" = "encoded" || {
  echo "encodeBody manual semantics were not preserved" >&2
  exit 1
}
grep -qi '^x-request-id: 44444444-4444-4444-8444-444444444444' \
  "$temp_dir/encoding.headers" || {
  echo "encoding response request ID was not injected" >&2
  exit 1
}

if grep -En 'edge\.request\.observation\.error|Uncaught Error' "$temp_dir/wrangler.log"; then
  echo "unexpected platform response observation failure" >&2
  exit 1
fi

echo "request-id response platform regression passed"
