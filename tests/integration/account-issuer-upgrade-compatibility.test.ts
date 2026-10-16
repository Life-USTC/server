import { createOAuthAccountIssuer } from "@/lib/auth/account-issuer";
import {
  accountIssuerForProvider,
  enabledSignInProviders,
  hasUsableAccount,
} from "@/lib/auth/sign-in-methods";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";

const origin = "http://localhost:3000";

// Production's issuer for the `oidc` provider is the AUTH_OIDC_ISSUER default,
// so leaving the variable unset makes these rows byte-identical to the ones
// Better Auth 1.7.2 wrote there.
const PRODUCTION_OIDC_ISSUER = "https://sso-proxy.lug.ustc.edu.cn/auth/oauth2";

const it = nodeProtocolTest.extend({
  protocolBindings: {
    NODE_ENV: "test",
    APP_CANONICAL_ORIGIN: origin,
    AUTH_GITHUB_ID: "fixture-github",
    AUTH_GITHUB_SECRET: "fixture-github-secret",
    AUTH_GOOGLE_ID: "",
    AUTH_GOOGLE_SECRET: "",
    AUTH_OIDC_CLIENT_ID: "fixture-oidc",
    AUTH_OIDC_CLIENT_SECRET: "fixture-oidc-secret",
  },
});

/**
 * Rows written before the 1.7.7 upgrade carry issuers produced by Better Auth
 * itself. Nothing rewrites them, so the upgrade is only safe while first-party
 * code keeps deriving the same strings and the narrowed account key still
 * resolves them.
 */
it(
  "accounts written before the upgrade stay resolvable and usable",
  { tags: ["@Account/Service"] },
  async ({ isolatedDatabase: { owner: db }, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const { getBetterAuthInstance } = await import("@/lib/auth/core");
      const context = await getBetterAuthInstance().$context;

      const legacy = [
        { provider: "oidc", issuer: PRODUCTION_OIDC_ISSUER },
        { provider: "github", issuer: "local:oauth:github" },
      ];

      for (const [index, row] of legacy.entries()) {
        const subject = `legacy-subject-${index}-${crypto.randomUUID()}`;
        const user = await db.user.create({
          data: {
            email: `legacy-${index}-${crypto.randomUUID()}@test.invalid`,
            name: "Pre-upgrade account",
            accounts: {
              create: {
                provider: row.provider,
                issuer: row.issuer,
                providerAccountId: subject,
              },
            },
          },
          include: { accounts: true },
        });

        // The issuer Better Auth 1.7.2 stored is still what first-party code
        // derives; a drift here would orphan every existing account.
        expect(accountIssuerForProvider(row.provider)).toBe(row.issuer);

        // 1.7.7 recognises accounts by (providerId, accountId). The legacy row
        // must resolve through that narrowed key.
        expect(
          await context.internalAdapter.findAccountByKey({
            providerId: row.provider,
            accountId: subject,
          }),
        ).toMatchObject({ userId: user.id, accountId: subject });

        expect(
          hasUsableAccount(
            { ...user.accounts[0], password: null },
            enabledSignInProviders(),
          ),
        ).toBe(true);
      }
    }),
);

/**
 * The issuer column is what retires accounts left behind by a replaced IdP.
 * Dropping Better Auth's own `issuer` field must not have cost us that.
 */
it(
  "an account from a replaced issuer is no longer a usable sign-in method",
  { tags: ["@Account/Service"] },
  async ({ isolatedDatabase: { owner: db }, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const subject = `stale-subject-${crypto.randomUUID()}`;
      const user = await db.user.create({
        data: {
          email: `stale-${crypto.randomUUID()}@test.invalid`,
          name: "Replaced issuer account",
          accounts: {
            create: {
              provider: "oidc",
              issuer: "https://sso-proxy.retired.example/auth/oauth2",
              providerAccountId: subject,
            },
          },
        },
        include: { accounts: true },
      });

      expect(
        hasUsableAccount(
          { ...user.accounts[0], password: null },
          enabledSignInProviders(),
        ),
      ).toBe(false);
    }),
);

/**
 * New rows are written by the create hook rather than by Better Auth, so they
 * have to land on the same strings as the rows already in the database.
 */
it(
  "accounts created after the upgrade match the pre-upgrade encoding",
  { tags: ["@Account/Service"] },
  async ({ isolatedDatabase: { owner: db }, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const { getBetterAuthInstance } = await import("@/lib/auth/core");
      const context = await getBetterAuthInstance().$context;

      const email = `fresh-${crypto.randomUUID()}@test.invalid`;
      const subject = `fresh-subject-${crypto.randomUUID()}`;
      const created = await context.internalAdapter.createOAuthUser(
        { name: "Post-upgrade account", email, emailVerified: true },
        { providerId: "github", accountId: subject },
      );
      expect(created).toBeTruthy();

      const stored = await db.account.findUniqueOrThrow({
        where: {
          provider_providerAccountId: {
            provider: "github",
            providerAccountId: subject,
          },
        },
      });
      expect(stored.issuer).toBe(createOAuthAccountIssuer("github"));
      expect(stored.issuer).toBe("local:oauth:github");
    }),
);
