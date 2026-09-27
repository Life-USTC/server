import {
  createLocalAccountIssuer,
  createOAuthAccountIssuer,
} from "@better-auth/core/db";
import { hashPassword } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { unlinkSettingsAccount } from "@/features/settings/server/settings-account-unlink";
import { removeSignInMethod } from "@/lib/auth/sign-in-methods";
import { authPrisma } from "@/lib/db/auth-prisma";
import { createFixturePrisma } from "../shared/prisma";

const fixture = createFixturePrisma();
const users: string[] = [];
const origin = "http://localhost:3000";

async function userWithMethods(providers: string[], passkeys: number) {
  const user = await fixture.user.create({
    data: {
      email: `method-policy-${crypto.randomUUID()}@example.test`,
      name: "Sign-in policy fixture",
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
  });
  users.push(user.id);
  return user;
}

async function cookieFor(userId: string) {
  const { getBetterAuthInstance } = await import("@/lib/auth/core");
  const context = await getBetterAuthInstance().$context;
  const token = crypto.randomUUID();
  await fixture.session.create({
    data: {
      userId,
      sessionToken: token,
      expires: new Date(Date.now() + 3600000),
    },
  });
  const encoder = new TextEncoder();
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
  return `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`)}`;
}

async function request(cookie: string, path: string, body: unknown) {
  const { getBetterAuthInstance } = await import("@/lib/auth/core");
  return getBetterAuthInstance().handler(
    new Request(`${origin}/api/auth${path}`, {
      method: "POST",
      headers: { cookie, origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeAll(() => {
  vi.stubEnv("E2E_DEBUG_AUTH", "1");
  vi.stubEnv("AUTH_GITHUB_ID", "fixture-github");
  vi.stubEnv("AUTH_GITHUB_SECRET", "fixture-github-secret");
  vi.stubEnv("AUTH_GOOGLE_ID", "");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "");
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await fixture.auditLog.deleteMany({
    where: {
      OR: [{ userId: { in: users } }, { subjectUserId: { in: users } }],
    },
  });
  await fixture.user.deleteMany({ where: { id: { in: users } } });
  await fixture.$disconnect();
  await authPrisma.$disconnect();
});

it("cases.account.sign-in-method-removal-atomic", async () => {
  // A disabled provider is not a recovery path, even when its row remains.
  const disabled = await userWithMethods(["github", "google"], 0);
  expect(await unlinkSettingsAccount(disabled.id, "github")).toBe(
    "last_account",
  );
  const cookie = await cookieFor(disabled.id);
  const denied = await request(cookie, "/unlink-account", {
    accountId: disabled.accounts.find((a) => a.provider === "github")?.id,
  });
  expect(denied.status).toBe(400);
  expect(await denied.json()).toMatchObject({
    code: "FAILED_TO_UNLINK_LAST_ACCOUNT",
  });
  expect(await fixture.account.count({ where: { userId: disabled.id } })).toBe(
    2,
  );
  // A valid enabled provider permits removal of the disabled one.
  const allowed = await request(cookie, "/unlink-account", {
    accountId: disabled.accounts.find((a) => a.provider === "google")?.id,
  });
  expect(allowed.status).toBe(200);

  // Only an enabled password credential with a password is a sign-in method.
  const passwordUser = await userWithMethods(["github", "credential"], 0);
  expect(await unlinkSettingsAccount(passwordUser.id, "github")).toBe(
    "last_account",
  );
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
  expect(await unlinkSettingsAccount(passwordUser.id, "github")).toBe(
    "last_account",
  );
  await fixture.account.update({
    where: {
      id: credential.id,
    },
    data: {
      issuer: createLocalAccountIssuer("credential"),
      providerAccountId: passwordUser.id,
    },
  });
  expect(await unlinkSettingsAccount(passwordUser.id, "github")).toBe(
    "unlinked",
  );
  const passwordLogin = await request("", "/sign-in/email", {
    email: passwordUser.email,
    password,
  });
  expect(passwordLogin.status).toBe(200);
  expect(await passwordLogin.json()).toMatchObject({
    user: { id: passwordUser.id },
  });

  // Better Auth's direct endpoint must recognize a remaining passkey too.
  const passkeyUser = await userWithMethods(["github"], 1);
  const passkeyCookie = await cookieFor(passkeyUser.id);
  expect(
    (
      await request(passkeyCookie, "/unlink-account", {
        accountId: passkeyUser.accounts[0].id,
      })
    ).status,
  ).toBe(200);
  const lastPasskey = await request(passkeyCookie, "/passkey/delete-passkey", {
    id: passkeyUser.passkeys[0].id,
  });
  expect(lastPasskey.status).toBe(400);
  expect(
    await fixture.passkey.count({ where: { userId: passkeyUser.id } }),
  ).toBe(1);

  // Both deletion surfaces serialize on the same user while retaining one method.
  for (let attempt = 0; attempt < 4; attempt++) {
    const concurrent = await userWithMethods(["github"], 1);
    const outcomes = await Promise.all([
      unlinkSettingsAccount(concurrent.id, "github"),
      removeSignInMethod(
        authPrisma,
        concurrent.id,
        "passkey",
        concurrent.passkeys[0].id,
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
