#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

test -f .svelte-kit/output/server/manifest.js || {
  echo "public route budget check requires a production build" >&2
  exit 1
}

bun run - <<'EOF'
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { manifest } from "./.svelte-kit/output/server/manifest.js";

// #533 names these crawlable entry/detail routes as the representative public
// hydration graph. Limits leave about 10% above the 2026-07-22 production-build
// baseline so normal chunking noise passes while material regressions do not.
const budgets = {
  "/": { gzipBytes: 170_000, requests: 56 },
  "/courses/[jwId]": { gzipBytes: 330_000, requests: 93 },
  "/sections/[jwId]": { gzipBytes: 390_000, requests: 103 },
};

let failed = false;

for (const [routeId, budget] of Object.entries(budgets)) {
  const route = manifest._.routes.find((candidate) => candidate.id === routeId);
  if (!route?.page) {
    throw new Error(`Cannot resolve page route ${routeId} from the build manifest`);
  }

  const scripts = new Set(manifest._.client.imports);
  const stylesheets = new Set(manifest._.client.stylesheets);
  const nodeIndexes = [
    ...route.page.layouts.filter((index) => index !== undefined),
    route.page.leaf,
  ];

  for (const index of nodeIndexes) {
    const node = await Bun.file(
      `.svelte-kit/output/server/nodes/${index}.js`,
    ).text();
    const exports = node.matchAll(
      /export const (imports|stylesheets) = (\[[^;]*\]);/g,
    );
    const found = new Set();

    for (const [, kind, files] of exports) {
      found.add(kind);
      const target = kind === "imports" ? scripts : stylesheets;
      for (const file of JSON.parse(files)) target.add(file);
    }

    if (!found.has("imports") || !found.has("stylesheets")) {
      throw new Error(
        `Cannot read client assets for build node ${index}; update the budget parser`,
      );
    }
  }

  const assets = [...scripts, ...stylesheets];
  let gzipBytes = 0;
  for (const asset of assets) {
    const bytes = await readFile(`.svelte-kit/output/client/${asset}`);
    gzipBytes += gzipSync(bytes, { level: 9 }).byteLength;
  }

  const requestCount = assets.length;
  console.log(
    `${routeId}: ${requestCount}/${budget.requests} initial asset requests, ` +
      `${gzipBytes}/${budget.gzipBytes} gzip bytes`,
  );

  if (requestCount > budget.requests || gzipBytes > budget.gzipBytes) {
    failed = true;
    console.error(
      `::error::${routeId} exceeds its production client dependency budget`,
    );
  }
}

if (failed) process.exit(1);
EOF
