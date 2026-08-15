import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";

const authOrigin = "http://localhost:3000";
const encoder = new TextEncoder();
const marker = crypto.randomUUID();
let userId = "";
let sessionId = "";
let unlinkAccountId = "";

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
  const session = await prisma.session.create({
    data: {
      expires: new Date(Date.now() + 60 * 60 * 1000),
      sessionToken: token,
      userId,
    },
    select: { id: true },
  });
  sessionId = session.id;
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
  return `${context.authCookies.sessionToken.name}=${value}`;
}

describe.sequential("committed Better Auth lifecycle audit", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
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
              issuer: "https://google.example",
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
    await prisma.auditLog.deleteMany({
      where: { OR: [{ userId }, { subjectUserId: userId }] },
    });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("audits profile update, account unlink, and sign-out only after success", async () => {
    const cookie = await createSessionCookie();
    const profile = await authRequest("/update-user", cookie, {
      name: "Private updated name",
    });
    expect(profile.status).toBe(200);

    const unlink = await authRequest("/unlink-account", cookie, {
      accountId: unlinkAccountId,
    });
    expect(unlink.status).toBe(200);

    const signOut = await authRequest("/sign-out", cookie);
    expect(signOut.status).toBe(200);
    expect(await prisma.session.count({ where: { id: sessionId } })).toBe(0);

    const rows = await prisma.auditLog.findMany({
      where: {
        subjectUserId: userId,
        action: {
          in: ["account_profile_update", "account_unlink", "account_sign_out"],
        },
      },
      orderBy: { createdAt: "asc" },
      select: {
        action: true,
        metadata: true,
        outcome: true,
        sessionId: true,
        targetId: true,
      },
    });
    expect(rows.map(({ action, outcome }) => ({ action, outcome }))).toEqual([
      { action: "account_profile_update", outcome: "success" },
      { action: "account_unlink", outcome: "success" },
      { action: "account_sign_out", outcome: "success" },
    ]);
    expect(rows[0].metadata).toEqual({ changedFields: ["name"] });
    expect(rows[1].targetId).toBe(unlinkAccountId);
    expect(rows[2]).toMatchObject({
      sessionId,
      targetId: sessionId,
    });
    expect(JSON.stringify(rows)).not.toContain("Private updated name");
    expect(JSON.stringify(rows)).not.toContain("sessionToken");
  });
});
