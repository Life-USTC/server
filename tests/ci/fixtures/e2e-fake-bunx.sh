#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

record_command() {
  local command="$1"
  shift
  [[ -n "${E2E_FAKE_COMMAND_LOG:-}" ]] || return 0

  {
    printf '%q' "$command"
    printf ' %q' "$@"
    printf '\n'
  } >>"$E2E_FAKE_COMMAND_LOG"
}

wait_for_worker() {
  local artifact_dir="$1"
  for _ in $(seq 1 30); do
    if grep -q '^outcome=running$' "${artifact_dir}/wrangler.status" 2>/dev/null; then
      return 0
    fi
    if [[ -f "${artifact_dir}/wrangler.pid" ]] &&
      ! kill -0 "$(<"${artifact_dir}/wrangler.pid")" >/dev/null 2>&1; then
      echo "fake Worker wrapper exited before startup" >&2
      return 1
    fi
    sleep 1
  done
  echo "fake Worker wrapper did not become healthy" >&2
  return 1
}

if [[ "${1:-}" == "playwright" ]]; then
  record_command "$@"
  artifact_dir="${E2E_WORKER_ARTIFACT_DIR:-playwright-report/worker}"
  mkdir -p "$artifact_dir"

  case "${E2E_FAKE_SHARD_MODE:-deterministic}" in
    deterministic)
      echo "kj/async-io-unix.c++:186 Broken pipe" >>"${artifact_dir}/wrangler.log"
      echo "deterministic Playwright assertion failed" >&2
      exit 1
      ;;
    worker-crash)
      attempt="${E2E_TEST_ATTEMPT:?E2E_TEST_ATTEMPT is required for worker-crash mode}"
      port="${E2E_PORT:?E2E_PORT is required for worker-crash mode}"
      server_pid=""

      stop_worker_wrapper() {
        if [[ -n "$server_pid" ]] && kill -0 "$server_pid" >/dev/null 2>&1; then
          kill -TERM "$server_pid" >/dev/null 2>&1 || true
        fi
        if [[ -n "$server_pid" ]]; then
          wait "$server_pid" >/dev/null 2>&1 || true
        fi
      }
      trap stop_worker_wrapper EXIT

      E2E_BUNX_BIN="${E2E_BUNX_BIN:-$0}" \
      E2E_PORT="$port" \
      E2E_WORKER_ARTIFACT_DIR="$artifact_dir" \
        bash "$repo_root/tests/ci/e2e-worker-server.sh" \
          >"${artifact_dir}/fake-wrapper.log" 2>&1 &
      server_pid="$!"

      wait_for_worker "$artifact_dir" || exit 1

      if [[ "$attempt" == "1" ]]; then
        worker_pid="$(<"${artifact_dir}/wrangler.pid")"
        kill -TERM "$worker_pid" || exit 1
        set +e
        wait "$server_pid"
        wrapper_exit_code="$?"
        set -e
        ((wrapper_exit_code != 0)) || {
          echo "fake Worker wrapper unexpectedly survived its Worker" >&2
          exit 1
        }
        grep -q '^outcome=worker_crash$' "${artifact_dir}/wrangler.status" || {
          echo "fake Worker wrapper did not record worker_crash" >&2
          exit 1
        }
        echo "fake shard attempt 1 observed the Worker crash" >&2
        exit 1
      fi

      [[ "$attempt" == "2" ]] || {
        echo "fake shard received unexpected attempt ${attempt}" >&2
        exit 1
      }
      curl --silent --show-error --fail --max-time 2 --noproxy '*' \
        "http://127.0.0.1:${port}/api/health" >/dev/null || {
        echo "fake shard attempt 2 could not reach the Worker" >&2
        exit 1
      }
      echo "fake shard attempt 2 passed after the Worker restart" >&2
      kill -TERM "$server_pid" || exit 1
      set +e
      wait "$server_pid"
      wrapper_exit_code="$?"
      set -e
      ((wrapper_exit_code == 0)) || {
        echo "fake Worker wrapper did not shut down cleanly" >&2
        exit 1
      }
      grep -q '^outcome=test_shutdown$' "${artifact_dir}/wrangler.status" || {
        echo "fake Worker wrapper did not record test_shutdown" >&2
        exit 1
      }
      exit 0
      ;;
    *)
      echo "unknown fake shard mode: ${E2E_FAKE_SHARD_MODE}" >&2
      exit 1
      ;;
  esac
fi

if [[ "${1:-}" == "prisma" ]]; then
  record_command "$@"
  exit 0
fi

if [[ "${1:-}" != "wrangler" ]]; then
  echo "fake bunx only supports Wrangler, Prisma, and Playwright in this regression test" >&2
  exit 1
fi

record_command "$@"

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
