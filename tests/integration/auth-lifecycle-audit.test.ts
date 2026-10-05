import { betterAuth } from "better-auth";
import { makeSignature } from "better-auth/crypto";
import { describe } from "vitest";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { buildBetterAuthOptions } from "@/lib/auth/better-auth-options";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";

const authOrigin = "http://localhost:3000";
const it = nodeProtocolTest
  .extend({
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
  })
  .extend(
    "lifecycle",
    async ({ isolatedDatabase: { owner: fixturePrisma }, protocolRuntime }) =>
      protocolRuntime.run(async () => {
        const marker = crypto.randomUUID();
        const userId = `auth-lifecycle-${marker}`;
        const replayAuditId = `audit-replay-${marker}`;
        // Each case constructs real production options and its own auth instance.
        const auth = betterAuth(buildBetterAuthOptions());
        const context = await auth.$context;
        const user = await fixturePrisma.$transaction((tx) =>
          tx.user.create({
            data: {
              id: userId,
              email: `${userId}@example.test`,
              name: "Before update",
              accounts: {
                create: [
                  {
                    issuer: "https://github.example",
                    provider: "github",
                    providerAccountId: `github-${marker}`,
                  },
                  {
                    issuer: "https://accounts.google.com",
                    provider: "google",
                    providerAccountId: `google-${marker}`,
                  },
                ],
              },
            },
            select: {
              accounts: { orderBy: { provider: "asc" }, select: { id: true } },
            },
          }),
        );
        async function authRequest(
          path: string,
          cookie: string,
          body?: unknown,
        ) {
          const response = await protocolRuntime.request(() =>
            auth.handler(
              new Request(`${authOrigin}/api/auth${path}`, {
                method: "POST",
                headers: {
                  cookie,
                  origin: authOrigin,
                  ...(body === undefined
                    ? {}
                    : { "content-type": "application/json" }),
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
              }),
            ),
          );
          // These lifecycle scenarios observe status and committed state; still
          // finish the real response before inspecting the resulting audit rows.
          await response.text();
          return response;
        }
        async function createSessionCookie() {
          const token = crypto.randomUUID();
          const session = await fixturePrisma.$transaction((tx) =>
            tx.session.create({
              data: {
                expires: new Date(Date.now() + 60 * 60 * 1000),
                sessionToken: token,
                userId,
              },
              select: { id: true },
            }),
          );
          return {
            cookie: `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`,
            sessionId: session.id,
            token,
          };
        }
        return {
          fixturePrisma,
          userId,
          unlinkAccountId: user.accounts[0].id,
          replayAuditId,
          runtime: protocolRuntime.run,
          request: protocolRuntime.request,
          authRequest,
          createSessionCookie,
        };
      }),
  );

describe("committed Better Auth lifecycle audit", () => {
  it("stores a producer-ID replay exactly once", {
    tags: ["@Account/Service"],
  }, async ({ lifecycle, expect }) => {
    const { fixturePrisma, userId, replayAuditId } = lifecycle;
    await lifecycle.runtime(async () => {
      const event = {
        action: "account_sign_in" as const,
        id: replayAuditId,
        subjectUserId: userId,
        userId,
      };

      await lifecycle.request(() => writeAuditLog(event));
      await lifecycle.request(() => writeAuditLog(event));

      await expect(
        fixturePrisma.auditLog.count({ where: { id: replayAuditId } }),
      ).resolves.toBe(1);
    });
  });

  it("audit.action-account-profile-update", {
    tags: ["@Account/REST"],
  }, async ({ lifecycle, expect }) => {
    const { fixturePrisma, userId, authRequest, createSessionCookie } =
      lifecycle;
    await lifecycle.runtime(async () => {
      const { cookie, token } = await createSessionCookie();
      const name = "Private updated name";
      expect((await authRequest("/update-user", cookie, { name })).status).toBe(
        200,
      );
      expect(
        await fixturePrisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        }),
      ).toEqual({ name });
      const rows = await fixturePrisma.auditLog.findMany({
        where: { subjectUserId: userId, action: "account_profile_update" },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        outcome: "success",
        userId,
        subjectUserId: userId,
        metadata: { changedFields: ["name"] },
      });
      expect(JSON.stringify(rows)).not.toContain(name);
      expect(JSON.stringify(rows)).not.toContain(token);
    });
  });

  it("audit.action-account-unlink", { tags: ["@Account/REST"] }, async ({
    lifecycle,
    expect,
  }) => {
    const {
      fixturePrisma,
      userId,
      unlinkAccountId,
      authRequest,
      createSessionCookie,
    } = lifecycle;
    await lifecycle.runtime(async () => {
      const { cookie, token } = await createSessionCookie();
      const secret = "private-provider-access-token";
      await fixturePrisma.account.update({
        where: { id: unlinkAccountId },
        data: { access_token: secret },
      });
      expect(
        (
          await authRequest("/unlink-account", cookie, {
            accountId: unlinkAccountId,
          })
        ).status,
      ).toBe(200);
      expect(
        await fixturePrisma.account.findUnique({
          where: { id: unlinkAccountId },
        }),
      ).toBeNull();
      const rows = await fixturePrisma.auditLog.findMany({
        where: { subjectUserId: userId, action: "account_unlink" },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        outcome: "success",
        userId,
        subjectUserId: userId,
        targetId: unlinkAccountId,
      });
      expect(JSON.stringify(rows)).not.toContain(secret);
      expect(JSON.stringify(rows)).not.toContain(token);
    });
  });

  it("audit.action-account-sign-out", { tags: ["@Account/REST"] }, async ({
    lifecycle,
    expect,
  }) => {
    const { fixturePrisma, userId, authRequest, createSessionCookie } =
      lifecycle;
    await lifecycle.runtime(async () => {
      const { cookie, sessionId, token } = await createSessionCookie();
      expect((await authRequest("/sign-out", cookie)).status).toBe(200);
      expect(
        await fixturePrisma.session.findUnique({ where: { id: sessionId } }),
      ).toBeNull();
      const rows = await fixturePrisma.auditLog.findMany({
        where: { subjectUserId: userId, action: "account_sign_out" },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        outcome: "success",
        userId,
        subjectUserId: userId,
        sessionId,
        targetId: sessionId,
      });
      expect(JSON.stringify(rows)).not.toContain(token);
    });
  });
});
