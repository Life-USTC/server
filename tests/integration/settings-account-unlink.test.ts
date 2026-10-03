import { describe } from "vitest";
import { unlinkSettingsAccount } from "@/features/settings/server/settings-account-unlink";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";

// These settings calls resolve provider availability from their own runtime.
// This does not reconfigure an auth singleton initialized in the same module/PID.
const it = nodeProtocolTest.extend({
  protocolBindings: {
    NODE_ENV: "test",
    E2E_DEBUG_AUTH: "",
    AUTH_GITHUB_ID: "test-github",
    AUTH_GITHUB_SECRET: "test-github-secret",
    AUTH_GOOGLE_ID: "test-google",
    AUTH_GOOGLE_SECRET: "test-google-secret",
    AUTH_OIDC_CLIENT_ID: "",
    AUTH_OIDC_CLIENT_SECRET: "",
  },
});

describe("settings account unlink database boundary", () => {
  it("uses a locked-down security-definer function", async ({
    isolatedDatabase: { owner: fixturePrisma },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const [definition] = await fixturePrisma.$queryRaw<
        Array<{
          publicCanExecute: boolean;
          securityDefiner: boolean;
          settings: string[] | null;
        }>
      >`
        SELECT
          procedure.prosecdef AS "securityDefiner",
          procedure.proconfig AS settings,
          EXISTS (
            SELECT 1
            FROM pg_catalog.aclexplode(
              COALESCE(
                procedure.proacl,
                pg_catalog.acldefault('f'::"char", procedure.proowner)
              )
            ) AS privilege
            WHERE privilege.grantee = 0
              AND privilege.privilege_type = 'EXECUTE'
          ) AS "publicCanExecute"
        FROM pg_catalog.pg_proc AS procedure
        WHERE procedure.oid = pg_catalog.to_regprocedure(
          'public.remove_sign_in_method(text,text,text,jsonb)'
        )
      `;

      expect(definition).toEqual({
        publicCanExecute: false,
        securityDefiner: true,
        settings: ['search_path=""'],
      });
    });
  });

  it("atomically removes one provider but never the last account", async ({
    isolatedDatabase: { owner: fixturePrisma },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const marker = `settings-unlink-${crypto.randomUUID()}`;
      const user = await fixturePrisma.$transaction((tx) =>
        tx.user.create({
          data: {
            email: `${marker}@example.test`,
            name: marker,
            accounts: {
              create: [
                {
                  issuer: "https://github.com",
                  provider: "github",
                  providerAccountId: `${marker}-github`,
                },
                {
                  issuer: "https://accounts.google.com",
                  provider: "google",
                  providerAccountId: `${marker}-google`,
                },
              ],
            },
            verifiedEmails: {
              create: {
                email: `${marker}-github@example.test`,
                provider: "github",
              },
            },
          },
          select: { id: true },
        }),
      );
      const userId = user.id;
      const unlink = (provider: string) =>
        protocolRuntime.request(() => unlinkSettingsAccount(userId, provider));

      await expect(unlink("github")).resolves.toBe("unlinked");
      await expect(unlink("google")).resolves.toBe("last_account");
      await expect(unlink("missing")).resolves.toBe("not_linked");

      await expect(
        fixturePrisma.account.findMany({
          where: { userId },
          select: { provider: true },
        }),
      ).resolves.toEqual([{ provider: "google" }]);
      await expect(
        fixturePrisma.verifiedEmail.count({
          where: { userId, provider: "github" },
        }),
      ).resolves.toBe(0);
    });
  });
});
