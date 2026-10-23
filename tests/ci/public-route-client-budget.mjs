import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { manifest } from "../../.svelte-kit/output/server/manifest.js";

// Check initial client assets for representative public entry and detail pages.
// Both request count and gzip size are limits; neither may hide a regression.
// SvelteKit 3 splits the client entry into more, smaller chunks (e.g. the new
// entry/payload chunk), which raises request counts by 2-3 per route and `/`
// by ~3.5 kB gzip while shrinking the heavy catalog detail pages by ~35%.
// Request and byte budgets below track that new baseline with slim headroom.
// `/` absorbed the product directory that `/catalog/features` used to render
// (its search field, filter toolbar and empty state), so its initial client
// payload grew ~4 kB gzip. The directory sits below the campus information and
// is a candidate for a deferred hydration boundary if this needs to come back
// down; the request count did not move.
const budgets = {
  "/": { gzipBytes: 210_000, requests: 73 },
  "/catalog/courses/[jwId]": { gzipBytes: 330_000, requests: 94 },
  "/catalog/sections/[jwId]": { gzipBytes: 390_000, requests: 104 },
  "/news": { gzipBytes: 232_000, requests: 93 },
  "/news/[id]": { gzipBytes: 221_000, requests: 84 },
  "/news/sources": { gzipBytes: 225_000, requests: 86 },
};

let failed = false;

for (const [routeId, budget] of Object.entries(budgets)) {
  const route = manifest.routes.find((candidate) => candidate.id === routeId);
  if (!route?.page) {
    throw new Error(
      `Cannot resolve page route ${routeId} from the build manifest`,
    );
  }

  const scripts = new Set(manifest.client.imports);
  const stylesheets = new Set(manifest.client.stylesheets);
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
