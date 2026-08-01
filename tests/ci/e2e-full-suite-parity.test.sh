#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

fail() {
  echo "e2e full-suite parity guard failed: $*" >&2
  exit 1
}

orchestration_script="${repo_root}/tests/ci/e2e-full-suite-parity.sh"
test -f "$orchestration_script" ||
  fail "missing ${orchestration_script}"

grep -q 'readonly E2E_SHARD_TOTAL=4' "$orchestration_script" ||
  fail "orchestration script must declare E2E_SHARD_TOTAL=4"

ci_shard_count="$(
  grep -cE 'shard: [0-9]+/4' "${repo_root}/.github/workflows/ci.yml" || true
)"
[[ "$ci_shard_count" == "4" ]] ||
  fail "ci.yml defines ${ci_shard_count} E2E shards, expected 4"

for shard in 1 2 3 4; do
  grep -q "\"e2e:test:shard${shard}\": \"playwright test --shard=${shard}/4\"" \
    "${repo_root}/package.json" ||
    fail "package.json is missing e2e:test:shard${shard}"
done

grep -q '"e2e:test": "bash tests/ci/e2e-full-suite-parity.sh"' \
  "${repo_root}/package.json" ||
  fail 'package.json e2e:test must invoke tests/ci/e2e-full-suite-parity.sh'

grep -q 'bun run db:migrate:deploy' "$orchestration_script" ||
  fail "orchestration script must migrate before each shard"
grep -q 'bunx prisma db seed' "$orchestration_script" ||
  fail "orchestration script must seed before each shard"
grep -q 'bunx playwright test --shard=' "$orchestration_script" ||
  fail "orchestration script must run sharded Playwright"

job_phase_script="${repo_root}/.github/workflows/db-backed-bun-job.yml"
grep -q 'bun run db:migrate:deploy' "$job_phase_script" ||
  fail "db-backed-bun-job.yml must migrate before E2E shards"
grep -q 'bunx prisma db seed' "$job_phase_script" ||
  fail "db-backed-bun-job.yml must seed before E2E shards"
grep -q 'bunx playwright test --shard="\$E2E_SHARD"' "$job_phase_script" ||
  fail "db-backed-bun-job.yml must run sharded Playwright"

echo "e2e full-suite parity guard passed"
