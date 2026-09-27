import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

const fixturePrisma = createFixturePrisma();

const authOrigin = "http://localhost:3000";
const encoder = new TextEncoder();
const marker = crypto.randomUUID();
let userId = "";
let unlinkAccountId = "";
const replayAuditId = `audit-replay-${marker}`;

async function authRequest(path: string, cookie: string, body?: unknown) {
  const { betterAuthInstance } = await import("@/lib/auth/core");
  return betterAuthInstance.handler(
    new Request(`${authOrigin}/api/auth${path}`, {
      method: "POST",
      headers: {
        cookie,
        origin: authOrigin,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
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
  const { getBetterAuthInstance } = await import("@/lib/auth/core");
  const context = await getBetterAuthInstance().$context;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(context.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(token),
  );
  const value = encodeURIComponent(
    `${token}.${base64(new Uint8Array(signature))}`,
  );
  return {
    cookie: `${context.authCookies.sessionToken.name}=${value}`,
    sessionId: session.id,
    token,
  };
}

describe("committed Better Auth lifecycle audit", { concurrent: false }, () => {
  beforeAll(async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "test-google");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "test-google-secret");
    const user = await fixturePrisma.user.create({
      data: {
        email: `auth-lifecycle-${marker}@example.test`,
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
        id: true,
        accounts: { orderBy: { provider: "asc" }, select: { id: true } },
      },
    });
    userId = user.id;
    unlinkAccountId = user.accounts[0].id;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await fixturePrisma.auditLog.deleteMany({
      where: {
        OR: [{ id: replayAuditId }, { userId }, { subjectUserId: userId }],
      },
    });
    await fixturePrisma.user.deleteMany({ where: { id: userId } });
    await Promise.all([
      runtimePrisma.$disconnect(),
      authPrisma.$disconnect(),
      fixturePrisma.$disconnect(),
    ]);
  });

  it("stores a producer-ID replay exactly once", async () => {
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

  it("audit.action-account-profile-update", async () => {
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

  it("audit.action-account-unlink", async () => {
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

  it("audit.action-account-sign-out", async () => {
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
