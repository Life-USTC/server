#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${repo_root}/.github/scripts/retry.sh"

fail() {
  echo "retry test failed: $*" >&2
  exit 1
}

attempts=0
cleanups=0
sleeps=0

sleep() {
  sleeps=$((sleeps + 1))
}

always_fail() {
  attempts=$((attempts + 1))
  return 1
}

record_cleanup() {
  cleanups=$((cleanups + 1))
}

if retry_command 3 0 "test command" record_cleanup always_fail >/dev/null; then
  fail "permanent failure returned success"
fi
((attempts == 3)) || fail "permanent failure ran ${attempts} attempts, expected 3"
((cleanups == 2)) || fail "permanent failure ran ${cleanups} cleanups, expected 2"
((sleeps == 2)) || fail "permanent failure ran ${sleeps} sleeps, expected 2"

attempts=0
cleanups=0
sleeps=0

succeed_on_second_attempt() {
  attempts=$((attempts + 1))
  if ((attempts == 2)); then
    return 0
  fi
  return 1
}

retry_command 3 0 "test command" record_cleanup succeed_on_second_attempt >/dev/null ||
  fail "eventual success returned failure"
((attempts == 2)) || fail "eventual success ran ${attempts} attempts, expected 2"
((cleanups == 1)) || fail "eventual success ran ${cleanups} cleanups, expected 1"
((sleeps == 1)) || fail "eventual success ran ${sleeps} sleeps, expected 1"

echo "retry regression tests passed"
