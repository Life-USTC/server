#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fake_bin="$(mktemp -d)"
trap 'rm -rf "$fake_bin"' EXIT

# Records the psql variable files it is handed before seed.sh deletes them.
cat >"$fake_bin/psql" <<'EOF'
#!/usr/bin/env sh
set -eu
touch "$SEED_GUARD_PSQL_MARKER"
: >"$SEED_GUARD_PSQL_MARKER.files"
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-f" ]; then
    shift
    if [ "$1" != "prisma/seed.sql" ]; then
      printf '%s\n' "$1" >"$SEED_GUARD_PSQL_MARKER.credentials"
      test "$(stat -c '%a' "$1")" = 600
    fi
    cat "$1" >>"$SEED_GUARD_PSQL_MARKER.files"
  fi
  shift
done
exit "${SEED_GUARD_PSQL_EXIT_CODE:-0}"
EOF
chmod +x "$fake_bin/psql"

marker="$fake_bin/psql-called"
cd "$repo_root"

if PATH="$fake_bin:$PATH" ALLOW_DATABASE_SEED= DATABASE_URL=postgresql://invalid \
  SEED_GUARD_PSQL_MARKER="$marker" sh "$repo_root/prisma/seed.sh" \
  >/dev/null 2>&1; then
  echo "seed guard accepted a missing opt-in" >&2
  exit 1
fi
test ! -e "$marker"

# Both passwords are mandatory, including on local databases.
for database_url in postgresql://u:p@db.example.com/app postgresql://u:p@127.0.0.1/app; do
  for missing_password in DEV_ADMIN_PASSWORD DEV_DEBUG_PASSWORD; do
    if PATH="$fake_bin:$PATH" ALLOW_DATABASE_SEED=true \
      DATABASE_URL="$database_url" \
      DEV_ADMIN_PASSWORD=seed-guard-admin DEV_DEBUG_PASSWORD=seed-guard-debug \
      SEED_GUARD_PSQL_MARKER="$marker" env "$missing_password=" \
      sh "$repo_root/prisma/seed.sh" >/dev/null 2>&1; then
      echo "seed accepted a missing $missing_password" >&2
      exit 1
    fi
    test ! -e "$marker"
  done
done

# Explicit passwords are hashed at seed time and handed to seed.sql as variables.
PATH="$fake_bin:$PATH" ALLOW_DATABASE_SEED=true \
  DATABASE_URL=postgresql://u:p@db.example.com/app \
  DEV_ADMIN_PASSWORD=seed-guard-admin DEV_DEBUG_PASSWORD=seed-guard-debug \
  SEED_GUARD_PSQL_MARKER="$marker" sh "$repo_root/prisma/seed.sh"
test -e "$marker"
test ! -e "$(cat "$marker.credentials")"
for variable in dev_admin_password_hash dev_debug_password_hash; do
  grep -Eq "^\\\\set $variable '[0-9a-f]+:[0-9a-f]+'$" "$marker.files"
done
if grep -q "seed-guard-" "$marker.files"; then
  echo "seed variables leaked a plaintext password" >&2
  exit 1
fi

# Failed database commands still remove the temporary credential file.
if PATH="$fake_bin:$PATH" ALLOW_DATABASE_SEED=true \
  DATABASE_URL=postgresql://u:p@127.0.0.1/app \
  DEV_ADMIN_PASSWORD=seed-guard-admin DEV_DEBUG_PASSWORD=seed-guard-debug \
  SEED_GUARD_PSQL_MARKER="$marker" SEED_GUARD_PSQL_EXIT_CODE=1 \
  sh "$repo_root/prisma/seed.sh"; then
  echo "seed ignored a psql failure" >&2
  exit 1
fi
test ! -e "$(cat "$marker.credentials")"

# The committed SQL carries no credential hash of its own.
if grep -Eq "'[0-9a-f]{16,}:[0-9a-f]{32,}'" "$repo_root/prisma/seed.sql"; then
  echo "prisma/seed.sql contains a committed password hash" >&2
  exit 1
fi

echo "seed guard regression tests passed"
