import {
  createLocalAccountIssuer,
  createOAuthAccountIssuer,
} from "@better-auth/core/db";
import { hashPassword, makeSignature } from "better-auth/crypto";
import { unlinkSettingsAccount } from "@/features/settings/server/settings-account-unlink";
import { removeSignInMethod } from "@/lib/auth/sign-in-methods";
import { authPrisma } from "@/lib/db/auth-prisma";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";

const origin = "http://localhost:3000";
const it = nodeProtocolTest
  .extend({
    protocolBindings: {
      NODE_ENV: "test",
      APP_CANONICAL_ORIGIN: origin,
      E2E_DEBUG_AUTH: "1",
      DEV_DEBUG_PASSWORD: "fixture-debug-password",
      DEV_ADMIN_PASSWORD: "fixture-admin-password",
      AUTH_GITHUB_ID: "fixture-github",
      AUTH_GITHUB_SECRET: "fixture-github-secret",
      AUTH_GOOGLE_ID: "",
      AUTH_GOOGLE_SECRET: "",
      AUTH_OIDC_CLIENT_ID: "",
      AUTH_OIDC_CLIENT_SECRET: "",
    },
  })
  .extend(
    "signInMethods",
    async ({ isolatedDatabase: { owner: fixture }, protocolRuntime, task }) =>
      protocolRuntime.run(async () => {
        const { expect } = task.context;
        // Configure before constructing Better Auth's singleton for this module.
        // Different configurations still require separate module/process isolation.
        const { getBetterAuthInstance } = await import("@/lib/auth/core");
        const auth = getBetterAuthInstance();
        const context = await auth.$context;
        expect(auth.options.emailAndPassword?.enabled).toBe(true);
        expect(context.socialProviders.map((provider) => provider.id)).toEqual([
          "github",
        ]);

        async function userWithMethods(
          providers: string[],
          passkeys: number,
          verifiedEmailProvider?: string,
        ) {
          const email = `method-policy-${crypto.randomUUID()}@example.test`;
          return fixture.$transaction((tx) =>
            tx.user.create({
              data: {
                email,
                name: "Sign-in policy fixture",
                ...(verifiedEmailProvider
                  ? {
                      verifiedEmails: {
                        create: { email, provider: verifiedEmailProvider },
                      },
                    }
                  : {}),
                accounts: {
                  create: providers.map((provider) => ({
                    provider,
                    providerAccountId: crypto.randomUUID(),
                    issuer:
                      provider === "github"
                        ? createOAuthAccountIssuer("github")
                        : "https://accounts.google.com",
                  })),
                },
                passkeys: {
                  create: Array.from({ length: passkeys }, () => ({
                    publicKey: "fixture-key",
                    credentialID: crypto.randomUUID(),
                    counter: 0,
                    deviceType: "singleDevice",
                    backedUp: false,
                  })),
                },
              },
              include: { accounts: true, passkeys: true },
            }),
          );
        }

        async function cookieFor(userId: string) {
          const token = crypto.randomUUID();
          await fixture.$transaction((tx) =>
            tx.session.create({
              data: {
                userId,
                sessionToken: token,
                expires: new Date(Date.now() + 3600000),
              },
            }),
          );
          return `${context.authCookies.sessionToken.name}=${encodeURIComponent(
            `${token}.${await makeSignature(token, context.secret)}`,
          )}`;
        }

        function request(cookie: string, path: string, body: unknown) {
          return protocolRuntime.request(() =>
            auth.handler(
              new Request(`${origin}/api/auth${path}`, {
                method: "POST",
                headers: { cookie, origin, "content-type": "application/json" },
                body: JSON.stringify(body),
              }),
            ),
          );
        }

        return {
          userWithMethods,
          cookieFor,
          request,
          adapter: context.adapter,
        };
      }),
  );

// Status-only callers still consume the actual handler response.
async function consume(response: Response) {
  await response.text();
  return response;
}

for (const method of ["Service", "OAuth"] as const) {
  it(`disabled providers cannot replace the last usable sign-in method (${method})`, {
    tags: [`@Account/${method}`],
  }, async ({
    isolatedDatabase: { owner: fixture },
    protocolRuntime,
    signInMethods: { userWithMethods, cookieFor, request },
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      // A disabled provider is not a recovery path, even when its row remains.
      const disabled = await userWithMethods(["github", "google"], 0);
      if (method === "Service") {
        expect(
          await protocolRuntime.request(() =>
            unlinkSettingsAccount(disabled.id, "github"),
          ),
        ).toBe("last_account");
      } else {
        const cookie = await cookieFor(disabled.id);
        const denied = await request(cookie, "/unlink-account", {
          accountId: disabled.accounts.find((a) => a.provider === "github")?.id,
        });
        expect(denied.status).toBe(400);
        expect(await denied.json()).toMatchObject({
          code: "FAILED_TO_UNLINK_LAST_ACCOUNT",
        });
        expect(
          await fixture.account.count({ where: { userId: disabled.id } }),
        ).toBe(2);
        // A valid enabled provider permits removal of the disabled one.
        const allowed = await request(cookie, "/unlink-account", {
          accountId: disabled.accounts.find((a) => a.provider === "google")?.id,
        });
        expect(allowed.status).toBe(200);
        await allowed.text();
      }
    });
  });
}

it("a password permits provider removal only with a valid issuer and subject and still signs in", {
  tags: ["@Account/Service"],
}, async ({
  isolatedDatabase: { owner: fixture },
  protocolRuntime,
  signInMethods: { userWithMethods, request },
  expect,
}) => {
  await protocolRuntime.run(async () => {
    // Only an enabled password credential with a password is a sign-in method.
    const passwordUser = await userWithMethods(["github", "credential"], 0);
    expect(
      await protocolRuntime.request(() =>
        unlinkSettingsAccount(passwordUser.id, "github"),
      ),
    ).toBe("last_account");
    const credential = passwordUser.accounts.find(
      (account) => account.provider === "credential",
    );
    if (!credential) throw new Error("Missing fixture credential");
    const password = "Valid policy password 123!";
    await fixture.account.update({
      where: {
        id: credential.id,
      },
      data: { password: await hashPassword(password) },
    });
    // A password with an incompatible issuer/subject still cannot authenticate.
    expect(
      await protocolRuntime.request(() =>
        unlinkSettingsAccount(passwordUser.id, "github"),
      ),
    ).toBe("last_account");
    await fixture.account.update({
      where: {
        id: credential.id,
      },
      data: {
        issuer: createLocalAccountIssuer("credential"),
        providerAccountId: passwordUser.id,
      },
    });
    expect(
      await protocolRuntime.request(() =>
        unlinkSettingsAccount(passwordUser.id, "github"),
      ),
    ).toBe("unlinked");
    const passwordLogin = await request("", "/sign-in/email", {
      email: passwordUser.email,
      password,
    });
    expect(passwordLogin.status).toBe(200);
    expect(await passwordLogin.json()).toMatchObject({
      user: { id: passwordUser.id },
    });
  });
});

it("a remaining passkey permits account unlinking but cannot itself be removed last", {
  tags: ["@Account/OAuth"],
}, async ({
  isolatedDatabase: { owner: fixture },
  protocolRuntime,
  signInMethods: { userWithMethods, cookieFor, request },
  expect,
}) => {
  await protocolRuntime.run(async () => {
    // Better Auth's direct endpoint must recognize a remaining passkey too.
    const passkeyUser = await userWithMethods(["github"], 1);
    const passkeyCookie = await cookieFor(passkeyUser.id);
    expect(
      (
        await request(passkeyCookie, "/unlink-account", {
          accountId: passkeyUser.accounts[0].id,
        }).then(consume)
      ).status,
    ).toBe(200);
    const lastPasskey = await request(
      passkeyCookie,
      "/passkey/delete-passkey",
      {
        id: passkeyUser.passkeys[0].id,
      },
    );
    expect(lastPasskey.status).toBe(400);
    await lastPasskey.text();
    expect(
      await fixture.passkey.count({ where: { userId: passkeyUser.id } }),
    ).toBe(1);
  });
});

it("cases.account.sign-in-method-removal-atomic", {
  tags: ["@Account/Service"],
}, async ({
  isolatedDatabase: { owner: fixture },
  protocolRuntime,
  signInMethods: { userWithMethods },
  expect,
}) => {
  await protocolRuntime.run(async () => {
    // Both deletion surfaces serialize on the same user while retaining one method.
    for (let attempt = 0; attempt < 4; attempt++) {
      const concurrent = await userWithMethods(["github"], 1);
      const outcomes = await Promise.all([
        protocolRuntime.request(() =>
          unlinkSettingsAccount(concurrent.id, "github"),
        ),
        protocolRuntime.request(() =>
          removeSignInMethod(
            authPrisma,
            concurrent.id,
            "passkey",
            concurrent.passkeys[0].id,
          ),
        ),
      ]);
      expect(outcomes.sort()).toEqual(["last_account", "unlinked"]);
      const remaining = await fixture.user.findUniqueOrThrow({
        where: { id: concurrent.id },
        include: { accounts: true, passkeys: true },
      });
      expect(remaining.accounts.length + remaining.passkeys.length).toBe(1);
    }
  });
});

it("transaction adapters reject removing the last account or passkey", {
  tags: ["@Account/Service"],
}, async ({
  isolatedDatabase: { owner: fixture },
  protocolRuntime,
  signInMethods: { userWithMethods, adapter },
  expect,
}) => {
  await protocolRuntime.run(async () => {
    // Transaction adapters must apply the same guard to both method types.
    const accountOnly = await userWithMethods(["github"], 0);
    const passkeyOnly = await userWithMethods([], 1);
    for (const [model, id] of [
      ["account", accountOnly.accounts[0].id],
      ["passkey", passkeyOnly.passkeys[0].id],
    ]) {
      await expect(
        protocolRuntime.request(() =>
          adapter.transaction((tx) =>
            tx.delete({
              model,
              where: [{ field: "id", value: id }],
            }),
          ),
        ),
      ).rejects.toMatchObject({
        body: { code: "FAILED_TO_UNLINK_LAST_ACCOUNT" },
      });
    }
    expect(
      await fixture.account.count({ where: { userId: accountOnly.id } }),
    ).toBe(1);
    expect(
      await fixture.passkey.count({ where: { userId: passkeyOnly.id } }),
    ).toBe(1);
  });
});

it("transaction rollback restores sign-in methods and preserves independent visibility", {
  tags: ["@Account/Service"],
}, async ({
  isolatedDatabase: { owner: fixture },
  protocolRuntime,
  signInMethods: { userWithMethods, adapter },
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const rollback = await userWithMethods(["github"], 1, "github");
    const sentinel = new Error("Rollback sign-in method deletion");
    await expect(
      protocolRuntime.request(() =>
        adapter.transaction(async (tx) => {
          // Hold the same User lock the deletion function needs. A separate Prisma
          // connection here would deadlock instead of joining this transaction.
          await tx.update({
            model: "user",
            where: [{ field: "id", value: rollback.id }],
            update: { name: "Uncommitted name" },
          });
          await tx.delete({
            model: "account",
            where: [{ field: "id", value: rollback.accounts[0].id }],
          });
          expect(
            await tx.findOne({
              model: "account",
              where: [{ field: "id", value: rollback.accounts[0].id }],
            }),
          ).toBeNull();
          expect(
            await fixture.account.count({ where: { userId: rollback.id } }),
          ).toBe(1);
          expect(
            await fixture.verifiedEmail.count({
              where: { userId: rollback.id },
            }),
          ).toBe(1);
          throw sentinel;
        }),
      ),
    ).rejects.toBe(sentinel);
    expect(
      await fixture.account.count({ where: { userId: rollback.id } }),
    ).toBe(1);
    expect(
      await fixture.verifiedEmail.count({ where: { userId: rollback.id } }),
    ).toBe(1);
    expect(
      (await fixture.user.findUniqueOrThrow({ where: { id: rollback.id } }))
        .name,
    ).toBe(rollback.name);
  });
});

it("concurrent adapter removals retain exactly one sign-in method", {
  tags: ["@Account/Service"],
}, async ({
  isolatedDatabase: { owner: fixture },
  protocolRuntime,
  signInMethods: { userWithMethods, adapter },
  expect,
}) => {
  await protocolRuntime.run(async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const concurrent = await userWithMethods(["github"], 1);
      const outcomes = await Promise.allSettled([
        protocolRuntime.request(() =>
          adapter.transaction((tx) =>
            tx.delete({
              model: "account",
              where: [{ field: "id", value: concurrent.accounts[0].id }],
            }),
          ),
        ),
        protocolRuntime.request(() =>
          adapter.transaction((tx) =>
            tx.delete({
              model: "passkey",
              where: [{ field: "id", value: concurrent.passkeys[0].id }],
            }),
          ),
        ),
      ]);
      expect(outcomes.map((result) => result.status).sort()).toEqual([
        "fulfilled",
        "rejected",
      ]);
      const rejected = outcomes.find((result) => result.status === "rejected");
      expect(rejected).toMatchObject({
        reason: { body: { code: "FAILED_TO_UNLINK_LAST_ACCOUNT" } },
      });
      const remaining = await fixture.user.findUniqueOrThrow({
        where: { id: concurrent.id },
        include: { accounts: true, passkeys: true },
      });
      expect(remaining.accounts.length + remaining.passkeys.length).toBe(1);
    }
  });
});
