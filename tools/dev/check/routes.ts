import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { repoRoot, reportUnexpectedError } from "./common";

async function checkRouteConventions() {
  const routeRoots = ["src/routes/api", "src/routes/.well-known"];
  const jsonHelperAllowlist = new Set([
    "src/routes/api/auth/.well-known/openid-configuration/+server.ts",
    "src/routes/api/auth/[...auth]/+server.ts",
    "src/routes/api/auth/oauth2/device-authorization/+server.ts",
    "src/routes/api/auth/oauth2/token/+server.ts",
    "src/routes/api/dashboard-links/pin/+server.ts",
    "src/routes/api/dashboard-links/visit/+server.ts",
    "src/routes/api/health/+server.ts",
    "src/routes/api/mcp/+server.ts",
    "src/routes/api/mcp/.well-known/oauth-authorization-server/+server.ts",
    "src/routes/api/mcp/.well-known/openid-configuration/+server.ts",
    "src/routes/api/metrics/+server.ts",
    "src/routes/api/sections/[jwId]/calendar.ics/+server.ts",
    "src/routes/api/sections/calendar.ics/+server.ts",
    "src/routes/api/uploads/[id]/download/+server.ts",
    "src/routes/api/users/[userId]/calendar.ics/+server.ts",
    "src/routes/.well-known/oauth-authorization-server/+server.ts",
    "src/routes/.well-known/oauth-authorization-server/api/auth/+server.ts",
    "src/routes/.well-known/oauth-authorization-server/api/mcp/+server.ts",
    "src/routes/.well-known/oauth-protected-resource/+server.ts",
    "src/routes/.well-known/oauth-protected-resource/api/mcp/+server.ts",
    "src/routes/.well-known/openid-configuration/+server.ts",
    "src/routes/.well-known/openid-configuration/api/auth/+server.ts",
    "src/routes/.well-known/openid-configuration/api/mcp/+server.ts",
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
        if (entry.isFile() && entry.name === "+server.ts") {
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
      source.includes('from "@/lib/api/routes/') ||
      source.includes('from "@/lib/api/svelte-route"') ||
      source.includes("createOAuthDiscoveryRoute(") ||
      source.includes("createDiscoveryMetadataRoute(") ||
      source.includes("createDiscoveryRedirectRoute(") ||
      source.includes("getDiscoveryRedirectResponse(") ||
      source.includes("getDiscoveryOptionsResponse(")
    );
  }

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
}

try {
  await checkRouteConventions();
} catch (error: unknown) {
  reportUnexpectedError(error);
}
