import { betterAuth } from "better-auth";
import { makeSignature } from "better-auth/crypto";
import { describe, expect, test } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { buildBetterAuthOptions } from "@/lib/auth/better-auth-options";
import { createFixturePrisma, type TestPrismaClient } from "../shared/prisma";

const authOrigin = "http://localhost:3000";
type Lifecycle = {
  fixturePrisma: TestPrismaClient;
  userId: string;
  unlinkAccountId: string;
  replayAuditId: string;
  runtime<T>(work: () => Promise<T>): Promise<T>;
  authRequest(path: string, cookie: string, body?: unknown): Promise<Response>;
  createSessionCookie(): Promise<{
    cookie: string;
    sessionId: string;
    token: string;
  }>;
};
const it = test.extend<{ lifecycle: Lifecycle }>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
  lifecycle: async ({}, use) => {
    const fixturePrisma = createFixturePrisma();
    const marker = crypto.randomUUID();
    const userId = `auth-lifecycle-${marker}`;
    const replayAuditId = `audit-replay-${marker}`;
    function runtime<T>(work: () => Promise<T>) {
      if (!process.env.DATABASE_URL || !process.env.AUTH_DATABASE_URL)
        throw new Error(
          "Lifecycle tests require restricted runtime database URLs",
        );
      return runWithCloudflareRuntimeEnv(
        {
          APP_PUBLIC_ORIGIN: authOrigin,
          AUTH_GOOGLE_ID: "test-google",
          AUTH_GOOGLE_SECRET: "test-google-secret",
          HYPERDRIVE: { connectionString: process.env.DATABASE_URL },
          HYPERDRIVE_AUTH: { connectionString: process.env.AUTH_DATABASE_URL },
        },
        work,
      );
    }
    try {
      // Same production options and real handlers, with a case-owned auth
      // instance so provider configuration never changes process.env.
      const auth = await runtime(async () =>
        betterAuth(buildBetterAuthOptions()),
      );
      const user = await fixturePrisma.user.create({
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
      });
      async function authRequest(path: string, cookie: string, body?: unknown) {
        return auth.handler(
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
        );
      }
      async function createSessionCookie() {
        const token = crypto.randomUUID();
        const session = await fixturePrisma.session.create({
          data: {
            expires: new Date(Date.now() + 60 * 60 * 1000),
            sessionToken: token,
            userId,
          },
          select: { id: true },
        });
        const context = await auth.$context;
        return {
          cookie: `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`,
          sessionId: session.id,
          token,
        };
      }
      await use({
        fixturePrisma,
        userId,
        unlinkAccountId: user.accounts[0].id,
        replayAuditId,
        runtime,
        authRequest,
        createSessionCookie,
      });
    } finally {
      try {
        await fixturePrisma.$transaction(async (tx) => {
          await tx.auditLog.deleteMany({
            where: {
              OR: [
                { id: replayAuditId },
                { userId },
                { subjectUserId: userId },
              ],
            },
          });
          await tx.featureOperationEvent.deleteMany({ where: { userId } });
          await tx.user.deleteMany({ where: { id: userId } });
        });
      } finally {
        await fixturePrisma.$disconnect();
      }
    }
  },
});

describe("committed Better Auth lifecycle audit", () => {
  it("stores a producer-ID replay exactly once", async ({ lifecycle }) => {
    const { fixturePrisma, userId, replayAuditId } = lifecycle;
    await lifecycle.runtime(async () => {
      const event = {
        action: "account_sign_in" as const,
        id: replayAuditId,
        subjectUserId: userId,
        userId,
      };

      await writeAuditLog(event);
      await writeAuditLog(event);

      await expect(
        fixturePrisma.auditLog.count({ where: { id: replayAuditId } }),
      ).resolves.toBe(1);
    });
  });

  it("audit.action-account-profile-update", async ({ lifecycle }) => {
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

  it("audit.action-account-unlink", async ({ lifecycle }) => {
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

  it("audit.action-account-sign-out", async ({ lifecycle }) => {
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
