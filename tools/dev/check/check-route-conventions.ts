import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const repoRoot = process.cwd();
const routeRoots = ["src/app/api", "src/app/.well-known"];

const dynamicAllowlist = new Set([
  "src/app/api/auth/.well-known/openid-configuration/route.ts",
]);

const jsonHelperAllowlist = new Set([
  "src/app/.well-known/oauth-authorization-server/api/auth/route.ts",
  "src/app/.well-known/oauth-authorization-server/route.ts",
  "src/app/.well-known/oauth-protected-resource/api/mcp/route.ts",
  "src/app/.well-known/oauth-protected-resource/route.ts",
  "src/app/.well-known/openid-configuration/api/auth/route.ts",
  "src/app/.well-known/openid-configuration/route.ts",
  "src/app/api/auth/.well-known/openid-configuration/route.ts",
  "src/app/api/auth/[...auth]/route.ts",
  "src/app/api/auth/oauth2/device-authorization/route.ts",
  "src/app/api/auth/oauth2/token/route.ts",
  "src/app/api/dashboard-links/pin/route.ts",
  "src/app/api/dashboard-links/visit/route.ts",
  "src/app/api/mcp/route.ts",
  "src/app/api/metrics/route.ts",
  "src/app/api/sections/[jwId]/calendar.ics/route.ts",
  "src/app/api/sections/calendar.ics/route.ts",
  "src/app/api/uploads/[id]/download/route.ts",
  "src/app/api/users/[userId]/calendar.ics/route.ts",
]);

async function collectRouteFiles(relativeDir: string): Promise<string[]> {
  const absoluteDir = path.join(repoRoot, relativeDir);
  let entries: Dirent[] = [];

  try {
    entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        return collectRouteFiles(relativePath);
      }
      if (entry.isFile() && entry.name === "route.ts") {
        return [relativePath];
      }
      return [];
    }),
  );

  return results.flat();
}

function usesJsonHelpers(source: string) {
  return (
    source.includes("jsonResponse(") ||
    source.includes("handleRouteError(") ||
    source.includes("createOAuthDiscoveryRoute(") ||
    source.includes("createDiscoveryMetadataRoute(") ||
    source.includes("createDiscoveryRedirectRoute(") ||
    source.includes("getDiscoveryRedirectResponse(") ||
    source.includes("getDiscoveryOptionsResponse(")
  );
}

async function main() {
  const routeFiles = (
    await Promise.all(
      routeRoots.map((relativeDir) => collectRouteFiles(relativeDir)),
    )
  )
    .flat()
    .sort();

  const issues: string[] = [];

  for (const relativePath of routeFiles) {
    const source = await fs.readFile(path.join(repoRoot, relativePath), "utf8");

    if (
      !dynamicAllowlist.has(relativePath) &&
      !source.includes('export const dynamic = "force-dynamic"')
    ) {
      issues.push(`missing dynamic export: ${relativePath}`);
    }

    if (!jsonHelperAllowlist.has(relativePath) && !usesJsonHelpers(source)) {
      issues.push(`missing json helper usage: ${relativePath}`);
    }
  }

  if (issues.length > 0) {
    console.error("Route convention check failed:\n");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(`Checked ${routeFiles.length} route handlers`);
}

await main();
