#!/usr/bin/env bash
# Verify native argument/exit propagation with fake IO and no database or Worker.
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT
export E2E_SHARD_TEST_LOG="$test_dir/calls"
export E2E_BUNX_BIN="$test_dir/native"
cat >"$E2E_BUNX_BIN" <<'NATIVE'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$@" >>"$E2E_SHARD_TEST_LOG"
printf 'native output\n'
exit "$E2E_SHARD_TEST_EXIT"
NATIVE
chmod +x "$E2E_BUNX_BIN"

printf '%s\n' playwright test --shard=2/8 --config playwright.api.config.ts \
  'a case with spaces.test.ts' >"$test_dir/expected"
for expected_exit in 0 7 130; do
  : >"$E2E_SHARD_TEST_LOG"
  actual_exit=0
  E2E_SHARD_TEST_EXIT="$expected_exit" \
    bash "$repo_root/tests/ci/e2e-run-shard.sh" 2/8 \
      --config playwright.api.config.ts 'a case with spaces.test.ts' \
      >"$test_dir/output" || actual_exit="$?"
  [[ "$actual_exit" == "$expected_exit" ]]
  # Exact single invocation: neither deterministic failures nor cancellation replay.
  cmp "$test_dir/expected" "$E2E_SHARD_TEST_LOG"
  grep -qx 'native output' "$test_dir/output"
done
for invalid in '' 0/8 9/8 1/0 invalid; do
  : >"$E2E_SHARD_TEST_LOG"
  if E2E_SHARD_TEST_EXIT=0 bash "$repo_root/tests/ci/e2e-run-shard.sh" "$invalid" \
    >"$test_dir/output" 2>&1; then
    echo "Invalid native shard was accepted: $invalid" >&2
    exit 1
  fi
  [[ ! -s "$E2E_SHARD_TEST_LOG" ]]
done
echo 'Native Playwright shard argument and exit propagation passed.'
