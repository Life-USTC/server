#!/usr/bin/env bash
# Move REST-only Playwright specs from tests/e2e/src/app/api to tests/integration/rest.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

src_root="tests/e2e/src/app/api"
dest_root="tests/integration/rest"

keep_paths=(
  "$src_root/docs"
  "$src_root/oauth/register"
  "$src_root/mcp"
)

should_keep() {
  local path="$1"
  for keep in "${keep_paths[@]}"; do
    if [[ "$path" == "$keep" || "$path" == "$keep"/* ]]; then
      return 0
    fi
  done
  return 1
}

mkdir -p "$dest_root"

while IFS= read -r -d '' item; do
  if should_keep "$item"; then
    continue
  fi
  rel="${item#"$src_root"/}"
  target_dir="$dest_root/$(dirname "$rel")"
  mkdir -p "$target_dir"
  git mv "$item" "$target_dir/"
done < <(find "$src_root" -type f \( -name 'test.ts' -o -name '*.test.ts' \) -print0)

# Remove empty directories left under api/
find "$src_root" -type d -empty -delete 2>/dev/null || true

echo "Moved REST specs to $dest_root"
