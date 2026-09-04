import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function listTypeScriptFiles(directory: URL): Promise<URL[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const url = new URL(entry.name, directory);
      if (entry.isDirectory())
        return listTypeScriptFiles(new URL(`${entry.name}/`, directory));
      return entry.isFile() && entry.name.endsWith(".ts") ? [url] : [];
    }),
  );
  return nested.flat();
}

describe("database client boundaries", () => {
  it("keeps auth and OAuth modules off the app Prisma client", async () => {
    const oauthFiles = await listTypeScriptFiles(
      new URL("../../../../src/features/oauth/server/", import.meta.url),
    );
    const authRouteFiles = (
      await listTypeScriptFiles(
        new URL("../../../../src/lib/api/routes/", import.meta.url),
      )
    ).filter((file) => file.pathname.split("/").at(-1)?.startsWith("auth"));
    const files = [
      ...oauthFiles,
      ...authRouteFiles,
      new URL(
        "../../../../src/lib/auth/better-auth-options.ts",
        import.meta.url,
      ),
      new URL("../../../../src/lib/auth/debug-auth-user.ts", import.meta.url),
      new URL(
        "../../../../src/lib/auth/webhook-login-handler.ts",
        import.meta.url,
      ),
      new URL(
        "../../../../src/lib/oauth/active-user-grant.ts",
        import.meta.url,
      ),
      new URL(
        "../../../../src/features/admin/server/admin-oauth-delete-action.ts",
        import.meta.url,
      ),
      new URL(
        "../../../../src/features/admin/server/admin-oauth-page-data.ts",
        import.meta.url,
      ),
      new URL(
        "../../../../src/features/settings/server/settings-account-unlink.ts",
        import.meta.url,
      ),
    ];

    const violations: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (source.includes('"@/lib/db/prisma"')) {
        violations.push(file.pathname.split("/src/")[1] ?? file.pathname);
      }
    }

    expect(violations).toEqual([]);
  });
});
