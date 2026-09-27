import type { AuthContext } from "@better-auth/core";
import {
  runWithEndpointContext,
  runWithTransaction,
} from "@better-auth/core/context";
import { betterAuth } from "better-auth";
import { afterAll, afterEach, expect, it, vi } from "vitest";
import * as audit from "@/lib/audit/write-audit-log";
import { buildBetterAuthOptions } from "@/lib/auth/better-auth-options";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const origin = "http://localhost:3000";
const userIds: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await db.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

it("audit.action-account-create", async () => {
  const context = (await getBetterAuthInstance()
    .$context) as unknown as AuthContext;
  const email = `provision-${marker}@example.test`;
  const request = new Request(
    `${origin}/api/auth/callback/github?code=private-provider-code`,
    { headers: { "user-agent": "audit-test" } },
  );
  const observed: Array<{ user: boolean; account: boolean }> = [];
  const original = audit.fireAuditLog;
  vi.spyOn(audit, "fireAuditLog").mockImplementation(async (params) => {
    if (params.action === "account_create")
      observed.push({
        user: (await db.user.count({ where: { id: params.userId } })) === 1,
        account:
          (await db.account.count({ where: { userId: params.userId } })) === 1,
      });
    return original(params);
  });
  const provision = (accessToken: string) =>
    runWithEndpointContext({ context, path: "/callback/github", request }, () =>
      context.internalAdapter.createOAuthUser(
        { name: "Private upstream name", email, emailVerified: true },
        {
          providerId: "github",
          issuer: "https://github.com",
          accountId: `upstream-${marker}`,
          accessToken,
          refreshToken: "private-refresh-token",
          idToken: "private-id-token",
        },
      ),
    );
  await expect(provision("invalid\u0000provider-token")).rejects.toThrow();
  expect(await db.user.count({ where: { email } })).toBe(0);
  expect(observed).toEqual([]);
  const created = await provision("private-access-token");
  userIds.push(created.user.id);
  expect(observed).toEqual([{ user: true, account: true }]);
  const rows = await db.auditLog.findMany({
    where: { userId: created.user.id, action: "account_create" },
  });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    userId: created.user.id,
    subjectUserId: created.user.id,
    targetId: created.user.id,
    targetType: "user",
    channel: "auth",
    outcome: "success",
    metadata: null,
  });
  for (const secret of [
    email,
    "Private upstream name",
    "private-provider-code",
    "private-access-token",
    "private-refresh-token",
    "private-id-token",
  ])
    expect(JSON.stringify(rows)).not.toContain(secret);
});

it("audit.action-account-link", async () => {
  const context = (await getBetterAuthInstance()
    .$context) as unknown as AuthContext;
  const user = await db.user.create({
    data: { email: `link-${marker}@example.test`, name: "Private linked user" },
  });
  userIds.push(user.id);
  const authUser = await context.internalAdapter.findUserById(user.id);
  if (!authUser) throw new Error("Expected authentication user");
  const session = await context.internalAdapter.createSession(user.id);
  const endpointContext = {
    context: { ...context, session: { user: authUser, session } },
    path: "/callback/github",
    request: new Request(
      `${origin}/api/auth/callback/github?code=private-link-code`,
    ),
  };
  const observed: number[] = [];
  const original = audit.fireAuditLog;
  vi.spyOn(audit, "fireAuditLog").mockImplementation(async (params) => {
    if (params.action === "account_link")
      observed.push(
        await db.account.count({
          where: { id: params.targetId, userId: user.id },
        }),
      );
    return original(params);
  });
  const link = (accessToken: string) =>
    runWithEndpointContext(endpointContext, () =>
      runWithTransaction(context.adapter, () =>
        context.internalAdapter.linkAccount({
          userId: user.id,
          providerId: "github",
          issuer: "https://github.com",
          accountId: `linked-${marker}`,
          accessToken,
          refreshToken: "private-linked-refresh",
          idToken: "private-linked-id",
        }),
      ),
    );
  await expect(link("invalid\u0000access-token")).rejects.toThrow();
  expect(observed).toEqual([]);
  expect(await db.account.count({ where: { userId: user.id } })).toBe(0);
  const linked = await link("private-linked-access");
  if (!linked) throw new Error("Expected linked account");
  expect(observed).toEqual([1]);
  const rows = await db.auditLog.findMany({
    where: { userId: user.id, action: "account_link" },
  });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    userId: user.id,
    subjectUserId: user.id,
    targetId: linked.id,
    targetType: "account",
    channel: "auth",
    outcome: "success",
    metadata: { provider: "github" },
  });
  for (const secret of [
    "Private linked user",
    user.email,
    "private-link-code",
    "private-linked-access",
    "private-linked-refresh",
    "private-linked-id",
  ])
    if (secret) expect(JSON.stringify(rows)).not.toContain(secret);
});

it("audit.action-webhook-login", async () => {
  vi.stubEnv("WEBHOOK_LOGIN_ENABLED", "true");
  vi.stubEnv("WEBHOOK_SECRET", `private-webhook-secret-${marker}`);
  const auth = betterAuth(buildBetterAuthOptions());
  const user = await db.user.create({
    data: {
      email: `webhook-${marker}@example.test`,
      name: "Private webhook user",
    },
  });
  userIds.push(user.id);
  for (const lookup of ["email", "userId"] as const) {
    const response = await auth.handler(
      new Request(`${origin}/api/auth/webhook/login`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({
          secret: `private-webhook-secret-${marker}`,
          [lookup]: lookup === "email" ? user.email : user.id,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ ok: true, userId: user.id });
    expect(payload).not.toHaveProperty("token");
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const sessionResponse = await auth.handler(
      new Request(`${origin}/api/auth/get-session`, { headers: { cookie } }),
    );
    expect((await sessionResponse.json()).user.id).toBe(user.id);
  }
  const rows = await db.auditLog.findMany({
    where: { userId: user.id, action: "webhook_login" },
    orderBy: { createdAt: "asc" },
  });
  expect(rows).toHaveLength(2);
  expect(rows.map((row) => row.metadata)).toEqual([
    { lookup: "email" },
    { lookup: "userId" },
  ]);
  const sessions = await db.session.findMany({ where: { userId: user.id } });
  expect(sessions).toHaveLength(2);
  for (const secret of [
    `private-webhook-secret-${marker}`,
    user.email,
    ...sessions.map((row) => row.sessionToken),
  ])
    if (secret) expect(JSON.stringify(rows)).not.toContain(secret);
});
