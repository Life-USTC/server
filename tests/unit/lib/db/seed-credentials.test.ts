import { readFileSync } from "node:fs";
import { verifyPassword } from "better-auth/crypto";
import { describe, expect, it } from "vitest";
import { renderSeedCredentialVariables } from "../../../../prisma/seed-credentials";

function parseVariables(script: string) {
  const variables = new Map<string, string>();
  for (const line of script.trim().split("\n")) {
    const match = /^\\set (\w+) '([0-9a-f]+:[0-9a-f]+)'$/.exec(line);
    expect(match, line).not.toBeNull();
    variables.set(match?.[1] ?? "", match?.[2] ?? "");
  }
  return variables;
}

describe("development seed credentials", () => {
  it("keeps password hashes out of committed seed SQL", () => {
    const sql = readFileSync("prisma/seed.sql", "utf8");

    expect(sql).not.toMatch(/'[0-9a-f]{16,}:[0-9a-f]{32,}'/);
    expect(sql).toContain(":'dev_admin_password_hash'");
    expect(sql).toContain(":'dev_debug_password_hash'");
  });

  it("hashes configured passwords with fresh salts and accepts them through Better Auth", async () => {
    const env = {
      DEV_ADMIN_PASSWORD: " admin-from-env ",
      DEV_DEBUG_PASSWORD: "debug-'\\-from-env",
    };
    const firstScript = await renderSeedCredentialVariables(env);
    const first = parseVariables(firstScript);
    const second = parseVariables(await renderSeedCredentialVariables(env));

    expect([...first.keys()]).toEqual([
      "dev_admin_password_hash",
      "dev_debug_password_hash",
    ]);
    for (const [variable, password] of [
      ["dev_admin_password_hash", env.DEV_ADMIN_PASSWORD.trim()],
      ["dev_debug_password_hash", env.DEV_DEBUG_PASSWORD],
    ]) {
      expect(firstScript).not.toContain(password);
      await expect(
        verifyPassword({ hash: first.get(variable) ?? "", password }),
      ).resolves.toBe(true);
      expect(second.get(variable)).not.toBe(first.get(variable));
    }
    await expect(
      verifyPassword({
        hash: first.get("dev_admin_password_hash") ?? "",
        password: env.DEV_DEBUG_PASSWORD,
      }),
    ).resolves.toBe(false);
  });

  it.each([undefined, "", "  "])(
    "rejects missing or blank passwords (%j) without defaults",
    async (password) => {
      await expect(
        renderSeedCredentialVariables({
          DEV_ADMIN_PASSWORD: password,
          DEV_DEBUG_PASSWORD: "debug-from-env",
        }),
      ).rejects.toThrow("DEV_ADMIN_PASSWORD is required");
      await expect(
        renderSeedCredentialVariables({
          DEV_ADMIN_PASSWORD: "admin-from-env",
          DEV_DEBUG_PASSWORD: password,
        }),
      ).rejects.toThrow("DEV_DEBUG_PASSWORD is required");
    },
  );
});
