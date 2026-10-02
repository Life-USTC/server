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
shard_runner_script="${repo_root}/tests/ci/e2e-run-shard.sh"
test -f "$orchestration_script" ||
  fail "missing ${orchestration_script}"
test -f "$parallel_script" ||
  fail "missing ${parallel_script}"
test -f "$parallel_shard_script" ||
  fail "missing ${parallel_shard_script}"
test -f "$shard_runner_script" ||
  fail "missing ${shard_runner_script}"

grep -q 'readonly E2E_SHARD_TOTAL=24' "$orchestration_script" ||
  fail "orchestration script must declare E2E_SHARD_TOTAL=24"

bun -e '
  import { parse } from "yaml";
  const workflow = parse(await Bun.file(process.argv[1]).text());
  const shards = workflow.jobs["test-e2e"].strategy.matrix.include
    .map(({ shard }) => shard);
  const expected = Array.from({ length: 24 }, (_, index) => `${index + 1}/24`);
  if (JSON.stringify(shards) !== JSON.stringify(expected)) {
    throw new Error(`Browser CI shards differ from local partitions: ${shards}`);
  }
' "${repo_root}/.github/workflows/ci.yml" || fail "browser CI partitions differ"

grep -q '"e2e:test:shard": "bash tests/ci/e2e-run-shard.sh"' \
  "${repo_root}/package.json" ||
  fail "package.json must expose one parameterized native shard command"

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

grep -q 'source tests/ci/setup-runtime-database.sh' "$orchestration_script" ||
  fail "orchestration script must prepare restricted roles before the native suite"
grep -q 'bash tests/ci/e2e-run-shard.sh' "$orchestration_script" ||
  fail "orchestration script must use the native shard runner"

grep -q -- '--publish 127.0.0.1::5432' "$parallel_script" ||
  fail "parallel runner must allocate an isolated PostgreSQL port per shard"
grep -q 'E2E_REPORT_ROOT=' "$parallel_shard_script" ||
  fail "parallel runner must isolate Playwright reports per shard"
grep -q 'source tests/ci/setup-runtime-database.sh' "$parallel_shard_script" ||
  fail "parallel runner must route the Worker to its shard database"
grep -q 'bash tests/ci/e2e-run-shard.sh' "$parallel_shard_script" ||
  fail "parallel runner must use the native shard runner"
grep -q 'setsid bash tests/ci/e2e-local-shard.sh' "$parallel_script" ||
  fail "parallel runner must isolate each shard in a process group"
grep -q 'source tests/ci/e2e-process-groups.sh' "$parallel_script" ||
  fail "parallel runner must load the process ownership helper"
grep -q 'E2E_PROCESS_OWNER=' "$parallel_script" ||
  fail "parallel runner must mark owned processes before launching a shard"
grep -q 'e2e_signal_owned_processes.*KILL' "$parallel_script" ||
  fail "parallel runner must clean up owned processes after shard exit"
grep -q 'readonly shard_total=24' "$parallel_script" ||
  fail "parallel runner must execute all 24 CI partitions"

playwright_config="${repo_root}/playwright.config.ts"
grep -q 'failOnFlakyTests: !!process.env.CI' "$playwright_config" ||
  fail "Playwright must fail CI when a retry passes"
grep -q 'screenshot: { mode: "only-on-failure"' "$playwright_config" ||
  fail "global Playwright screenshots must be failure-only"

job_phase_script="${repo_root}/.github/workflows/db-backed-bun-job.yml"
static_job_phase_script="${repo_root}/.github/workflows/bun-job.yml"
visual_script="${repo_root}/tests/ci/visual-regression.test.sh"
grep -q 'source tests/ci/setup-runtime-database.sh' "$job_phase_script" ||
  fail "DB-backed jobs must prepare restricted runtime roles"
grep -q 'bash tests/ci/e2e-run-shard.sh "\$E2E_SHARD"' "$job_phase_script" ||
  fail "db-backed-bun-job.yml must use the native shard runner"
grep -q 'bash tests/ci/e2e-run-shard.sh "\$E2E_SHARD" --config playwright.api.config.ts' \
  "$job_phase_script" ||
  fail "ci:rest must use the native API shard runner"
if grep -q 'bunx playwright test --config playwright.api.config.ts' "$job_phase_script"; then
  fail "ci:rest must not invoke Playwright directly"
fi
grep -q 'VISUAL_REGRESSION=1 bash tests/ci/e2e-run-shard.sh 1/1 visual-matrix' \
  "$visual_script" ||
  fail "visual regression must use the native shard runner"
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
grep -q 'exec "$bunx_bin" playwright test --shard=' "$shard_runner_script" ||
  fail "shard runner must execute the requested native partition"
if grep -Eq 'webServer:|baseURL,' "$playwright_config" "${repo_root}/playwright.api.config.ts"; then
  fail "native fixtures must own Worker startup and origins"
fi
if grep -Eq 'migrate reset|prisma db seed|setup-runtime-database.sh reset' \
  "$orchestration_script" "$shard_runner_script" "${repo_root}/tests/ci/setup-runtime-database.sh"; then
  fail "private-case suites must not reset or seed a shared application graph"
fi
grep -Eq '^[[:space:]]*bash tests/ci/e2e-run-shard\.test\.sh[[:space:]]*$' \
  "$static_job_phase_script" ||
  fail "CI verify phase must check native argument and failure propagation"

echo "e2e full-suite parity guard passed"
