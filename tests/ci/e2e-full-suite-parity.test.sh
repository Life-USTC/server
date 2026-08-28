#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

fail() {
  echo "e2e full-suite parity guard failed: $*" >&2
  exit 1
}

orchestration_script="${repo_root}/tests/ci/e2e-full-suite-parity.sh"
parallel_script="${repo_root}/tests/ci/e2e-parallel-local.sh"
parallel_shard_script="${repo_root}/tests/ci/e2e-local-shard.sh"
worker_server_script="${repo_root}/tests/ci/e2e-worker-server.sh"
shard_runner_script="${repo_root}/tests/ci/e2e-run-shard.sh"
test -f "$orchestration_script" ||
  fail "missing ${orchestration_script}"
test -f "$parallel_script" ||
  fail "missing ${parallel_script}"
test -f "$parallel_shard_script" ||
  fail "missing ${parallel_shard_script}"
test -f "$worker_server_script" ||
  fail "missing ${worker_server_script}"
test -f "$shard_runner_script" ||
  fail "missing ${shard_runner_script}"

grep -q 'readonly E2E_SHARD_TOTAL=4' "$orchestration_script" ||
  fail "orchestration script must declare E2E_SHARD_TOTAL=4"

ci_shard_count="$(
  grep -cE 'shard: [0-9]+/4' "${repo_root}/.github/workflows/ci.yml" || true
)"
[[ "$ci_shard_count" == "4" ]] ||
  fail "ci.yml defines ${ci_shard_count} E2E shards, expected 4"

for shard in 1 2 3 4; do
  grep -q "\"e2e:test:shard${shard}\": \"bash tests/ci/e2e-run-shard.sh ${shard}/4\"" \
    "${repo_root}/package.json" ||
    fail "package.json is missing e2e:test:shard${shard}"
done

grep -q '"e2e:test": "bash tests/ci/e2e-full-suite-parity.sh"' \
  "${repo_root}/package.json" ||
  fail 'package.json e2e:test must invoke tests/ci/e2e-full-suite-parity.sh'
grep -q '"e2e:test:parallel": "bash tests/ci/e2e-parallel-local.sh"' \
  "${repo_root}/package.json" ||
  fail 'package.json must expose the isolated local parallel runner'
grep -q '"rest:test": "playwright test --config playwright.api.config.ts"' \
  "${repo_root}/package.json" ||
  fail 'package.json rest:test must remain a direct local Playwright command'
grep -q '"e2e:visual": "VISUAL_REGRESSION=1 playwright test visual-matrix"' \
  "${repo_root}/package.json" ||
  fail 'package.json e2e:visual must remain a direct local Playwright command'

grep -q 'bun run db:migrate:deploy' "$orchestration_script" ||
  fail "orchestration script must migrate before each shard"
grep -q 'bunx prisma db seed' "$orchestration_script" ||
  fail "orchestration script must seed before each shard"
grep -q 'bash tests/ci/e2e-run-shard.sh' "$orchestration_script" ||
  fail "orchestration script must use the infrastructure-aware shard runner"

grep -q -- '--publish 127.0.0.1::5432' "$parallel_script" ||
  fail "parallel runner must allocate an isolated PostgreSQL port per shard"
grep -q 'E2E_PERSIST_TO=' "$parallel_shard_script" ||
  fail "parallel runner must isolate Wrangler state per shard"
grep -q 'E2E_INSPECTOR_PORT=' "$parallel_shard_script" ||
  fail "parallel runner must isolate Wrangler inspector ports per shard"
grep -q 'E2E_REPORT_ROOT=' "$parallel_shard_script" ||
  fail "parallel runner must isolate Playwright reports per shard"
grep -q 'PLAYWRIGHT_BASE_URL=' "$parallel_shard_script" ||
  fail "parallel runner must expose its shard URL to E2E helpers"
grep -q 'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=' "$parallel_shard_script" ||
  fail "parallel runner must route the Worker to its shard database"
grep -q 'bash tests/ci/e2e-run-shard.sh' "$parallel_shard_script" ||
  fail "parallel runner must use the infrastructure-aware shard runner"
grep -q 'setsid bash tests/ci/e2e-local-shard.sh' "$parallel_script" ||
  fail "parallel runner must isolate each shard in a process group"
grep -q 'kill -KILL -- "-${pid}"' "$parallel_script" ||
  fail "parallel runner must clean up an interrupted shard process group"
grep -q 'assert_port_available' "$parallel_script" ||
  fail "parallel runner must reject occupied Worker ports before setup"

playwright_config="${repo_root}/playwright.config.ts"
grep -q 'failOnFlakyTests: !!process.env.CI' "$playwright_config" ||
  fail "Playwright must fail CI when a retry passes"
grep -q 'screenshot: { mode: "only-on-failure"' "$playwright_config" ||
  fail "global Playwright screenshots must be failure-only"

if grep -q 'PLAYWRIGHT_BASE_URL = "http://localhost:3000"' \
  "${repo_root}/tests/e2e/utils/e2e-db/core.ts"; then
  fail "E2E database helpers must not hardcode the default Worker port"
fi

job_phase_script="${repo_root}/.github/workflows/db-backed-bun-job.yml"
visual_script="${repo_root}/tests/ci/visual-regression.test.sh"
grep -q 'bun run db:migrate:deploy' "$job_phase_script" ||
  fail "db-backed-bun-job.yml must migrate before E2E shards"
grep -q 'bunx prisma db seed' "$job_phase_script" ||
  fail "db-backed-bun-job.yml must seed before E2E shards"
grep -q 'bash tests/ci/e2e-run-shard.sh "\$E2E_SHARD"' "$job_phase_script" ||
  fail "db-backed-bun-job.yml must use the infrastructure-aware shard runner"
grep -q 'bash tests/ci/e2e-run-shard.sh 1/1 --config playwright.api.config.ts' \
  "$job_phase_script" ||
  fail "ci:integration must use the infrastructure-aware API shard runner"
if grep -q 'bunx playwright test --config playwright.api.config.ts' "$job_phase_script"; then
  fail "ci:integration must not invoke Playwright directly"
fi
grep -q 'VISUAL_REGRESSION=1 bash tests/ci/e2e-run-shard.sh 1/1 visual-matrix' \
  "$visual_script" ||
  fail "visual regression must use the infrastructure-aware shard runner"
if grep -q 'VISUAL_REGRESSION=1 bunx playwright test visual-matrix' "$visual_script"; then
  fail "visual regression must not invoke Playwright directly"
fi
grep -q 'upload-artifact-name: playwright-report-integration' \
  "${repo_root}/.github/workflows/ci.yml" ||
  fail "integration Worker diagnostics must be uploaded as a CI artifact"
grep -q 'upload-artifact-name: playwright-report-visual' \
  "${repo_root}/.github/workflows/ci.yml" ||
  fail "visual Worker diagnostics must be uploaded as a CI artifact"

grep -q 'retries: 0' "$playwright_config" ||
  fail "Playwright must not retry deterministic tests"
grep -q 'E2E_WORKER_ARTIFACT_DIR' "$worker_server_script" ||
  fail "Worker wrapper must persist its artifact directory"
grep -q 'health_check' "$worker_server_script" ||
  fail "Worker wrapper must health-check before and during tests"
grep -Fq 'outcome=(startup_failure|worker_crash|health_failure)' "$shard_runner_script" ||
  fail "shard runner must classify only confirmed Worker failures"
grep -q 'playwright test --shard=' "$shard_runner_script" ||
  fail "shard runner must execute the requested Playwright shard"
grep -q 'prisma migrate reset --force' "$shard_runner_script" ||
  fail "CI shard retries must reset the disposable database before replay"
grep -q 'prisma db seed' "$shard_runner_script" ||
  fail "CI shard retries must seed the reset database before replay"
grep -q 'wrangler.log' "$worker_server_script" ||
  fail "Worker wrapper must capture Wrangler logs"
grep -q 'bash tests/ci/e2e-worker-server.test.sh' "$job_phase_script" ||
  fail "CI verify phase must run the Worker termination regression"

echo "e2e full-suite parity guard passed"
