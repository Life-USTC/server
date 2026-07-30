#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fake_bin="$(mktemp -d)"
trap 'rm -rf "$fake_bin"' EXIT

cat >"$fake_bin/psql" <<'EOF'
#!/usr/bin/env sh
touch "$SEED_GUARD_PSQL_MARKER"
EOF
chmod +x "$fake_bin/psql"

marker="$fake_bin/psql-called"
if PATH="$fake_bin:$PATH" DATABASE_URL=postgresql://invalid \
  SEED_GUARD_PSQL_MARKER="$marker" sh "$repo_root/prisma/seed.sh" \
  >/dev/null 2>&1; then
  echo "seed guard accepted a missing opt-in" >&2
  exit 1
fi
test ! -e "$marker"

PATH="$fake_bin:$PATH" ALLOW_DATABASE_SEED=true \
  DATABASE_URL=postgresql://invalid SEED_GUARD_PSQL_MARKER="$marker" \
  sh "$repo_root/prisma/seed.sh"
test -e "$marker"

echo "seed guard regression tests passed"
