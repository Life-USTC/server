import { createLocalAccountIssuer } from "@better-auth/core/db";
import { expect, type Page, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import type { AuditAction } from "@/generated/prisma/client";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

async function signedUser(page: Page) {
  const user = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        email: `audit-policy-${crypto.randomUUID()}@example.test`,
        name: "Private audit user",
        username: `audit${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
      },
    }),
  );
  const cookie = await createSignedSessionCookie(user.id);
  await page.context().addCookies([cookie]);
  return {
    user,
    cookie,
    async cleanup() {
      await withE2ePrisma(async (db) => {
        await db.auditLog.deleteMany({
          where: { OR: [{ userId: user.id }, { subjectUserId: user.id }] },
        });
        await db.user.delete({ where: { id: user.id } });
      });
    },
  };
}

async function tokenFor(userId: string) {
  return withE2ePrisma((db) =>
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { calendarFeedToken: true },
    }),
  );
}
async function rowsFor(userId: string, action: AuditAction) {
  return withE2ePrisma((db) =>
    db.auditLog.findMany({
      where: { userId, action },
      orderBy: { createdAt: "asc" },
    }),
  );
}

test("audit.action-account-calendar-token-create", async ({ page }) => {
  const fixture = await signedUser(page);
  try {
    expect((await tokenFor(fixture.user.id)).calendarFeedToken).toBeNull();
    for (let request = 0; request < 2; request++) {
      const response = await page.request.get("/workspace/subscriptions");
      expect(response.status()).toBe(200);
    }
    const token = (await tokenFor(fixture.user.id)).calendarFeedToken;
    expect(token).toBeTruthy();
    await expect
      .poll(
        async () =>
          (await rowsFor(fixture.user.id, "account_calendar_token_create"))
            .length,
      )
      .toBe(1);
    const rows = await rowsFor(
      fixture.user.id,
      "account_calendar_token_create",
    );
    expect(rows[0]).toMatchObject({
      outcome: "success",
      targetType: "calendar_feed",
      targetId: fixture.user.id,
      subjectUserId: fixture.user.id,
    });
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(JSON.stringify(rows)).not.toContain(fixture.cookie.value);
    expect(JSON.stringify(rows)).not.toContain(fixture.user.email);
  } finally {
    await fixture.cleanup();
  }
});

test("audit.action-account-calendar-token-rotate", async ({ page }) => {
  const fixture = await signedUser(page);
  const constraint = `audit_token_${crypto.randomUUID().replaceAll("-", "")}`;
  const oldToken = crypto.randomUUID();
  const privateMarker = `private-body-${crypto.randomUUID()}`;
  let installed = false;
  async function rotate() {
    return page.request.post(
      "/account/settings/security?/rotateCalendarToken",
      {
        form: { privateMarker },
        headers: { origin: PLAYWRIGHT_BASE_URL, accept: "text/html" },
        maxRedirects: 0,
      },
    );
  }
  try {
    await withE2ePrisma(async (db) => {
      await db.user.update({
        where: { id: fixture.user.id },
        data: { calendarFeedToken: oldToken },
      });
      await db.session.updateMany({
        where: { userId: fixture.user.id },
        data: { createdAt: new Date("2000-01-01T00:00:00Z") },
      });
    });
    const denied = await rotate();
    expect(denied.status(), denied.headers().location).toBe(403);
    expect((await tokenFor(fixture.user.id)).calendarFeedToken).toBe(oldToken);
    await withE2ePrisma(async (db) => {
      await db.session.updateMany({
        where: { userId: fixture.user.id },
        data: { createdAt: new Date() },
      });
      await db.$executeRawUnsafe(
        `ALTER TABLE public."User" ADD CONSTRAINT "${constraint}" CHECK ("id" <> '${fixture.user.id.replaceAll("'", "''")}' OR "calendarFeedToken" = '${oldToken}') NOT VALID`,
      );
    });
    installed = true;
    expect((await rotate()).status()).toBe(500);
    expect((await tokenFor(fixture.user.id)).calendarFeedToken).toBe(oldToken);
    await withE2ePrisma((db) =>
      db.$executeRawUnsafe(
        `ALTER TABLE public."User" DROP CONSTRAINT "${constraint}"`,
      ),
    );
    installed = false;
    const success = await rotate();
    expect(success.status()).toBe(303);
    expect(success.headers().location).toContain(
      "message=CalendarTokenRotated",
    );
    const newToken = (await tokenFor(fixture.user.id)).calendarFeedToken;
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(oldToken);
    await expect
      .poll(
        async () =>
          (await rowsFor(fixture.user.id, "account_calendar_token_rotate"))
            .length,
      )
      .toBe(3);
    const rows = await rowsFor(
      fixture.user.id,
      "account_calendar_token_rotate",
    );
    expect(rows.map(({ outcome }) => outcome)).toEqual([
      "denied",
      "failure",
      "success",
    ]);
    for (const row of rows)
      expect(row).toMatchObject({
        subjectUserId: fixture.user.id,
        targetId: fixture.user.id,
        targetType: "calendar_feed",
        channel: "web",
      });
    const serialized = JSON.stringify(rows);
    for (const secret of [
      oldToken,
      newToken,
      fixture.cookie.value,
      privateMarker,
      fixture.user.email,
    ])
      expect(serialized).not.toContain(secret);
  } finally {
    if (installed)
      await withE2ePrisma((db) =>
        db.$executeRawUnsafe(
          `ALTER TABLE public."User" DROP CONSTRAINT "${constraint}"`,
        ),
      );
    await fixture.cleanup();
  }
});

async function withPasskey(
  page: Page,
  callback: (fixture: Awaited<ReturnType<typeof signedUser>>) => Promise<void>,
) {
  const fixture = await signedUser(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        ctap2Version: "ctap2_1",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  try {
    await gotoAndWaitForReady(page, "/account/settings/accounts");
    async function register(name: string) {
      const card = page.locator("[data-passkey-settings]");
      await card.getByLabel(/通行密钥名称|Passkey name/i).fill(name);
      await card
        .getByRole("button", { name: /添加通行密钥|Add passkey/i })
        .click();
      await expect(
        card.getByLabel(new RegExp(`重命名 ${name}|Rename ${name}`, "i")),
      ).toHaveValue(name);
      const count = await withE2ePrisma((db) =>
        db.passkey.count({ where: { userId: fixture.user.id } }),
      );
      await expect
        .poll(
          async () =>
            (await rowsFor(fixture.user.id, "account_passkey_create")).length,
        )
        .toBe(count);
    }
    await register("Private registration name");
    await callback(fixture);
  } finally {
    await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    await cdp.send("WebAuthn.disable");
    await fixture.cleanup();
  }
}

async function expectPasskeyAudit(
  fixture: Awaited<ReturnType<typeof signedUser>>,
  action: AuditAction,
  passkey: { id: string; credentialID: string; publicKey: string },
  privateName: string,
) {
  await expect
    .poll(async () => (await rowsFor(fixture.user.id, action)).length)
    .toBe(1);
  const rows = await rowsFor(fixture.user.id, action);
  expect(rows[0]).toMatchObject({
    outcome: "success",
    targetType: "passkey",
    targetId: passkey.id,
    subjectUserId: fixture.user.id,
    userId: fixture.user.id,
  });
  const serialized = JSON.stringify(rows);
  for (const secret of [
    passkey.credentialID,
    passkey.publicKey,
    privateName,
    fixture.cookie.value,
    fixture.user.email,
  ])
    expect(serialized).not.toContain(secret);
}

test("audit.action-account-passkey-create", async ({ page }) => {
  await withPasskey(page, async (fixture) => {
    const passkey = await withE2ePrisma((db) =>
      db.passkey.findFirstOrThrow({ where: { userId: fixture.user.id } }),
    );
    expect(passkey.publicKey.length).toBeGreaterThan(0);
    expect(passkey.credentialID.length).toBeGreaterThan(0);
    await expectPasskeyAudit(
      fixture,
      "account_passkey_create",
      passkey,
      "Private registration name",
    );
  });
});

test("audit.action-account-passkey-update", async ({ page }) => {
  await withPasskey(page, async (fixture) => {
    const passkey = await withE2ePrisma((db) =>
      db.passkey.findFirstOrThrow({ where: { userId: fixture.user.id } }),
    );
    const privateName = "Private updated passkey name";
    const response = await page.request.post(
      "/api/auth/passkey/update-passkey",
      {
        data: { id: passkey.id, name: privateName },
        headers: { origin: PLAYWRIGHT_BASE_URL },
      },
    );
    expect(response.status()).toBe(200);
    expect(
      await withE2ePrisma((db) =>
        db.passkey.findUniqueOrThrow({ where: { id: passkey.id } }),
      ),
    ).toMatchObject({ name: privateName });
    await expectPasskeyAudit(
      fixture,
      "account_passkey_update",
      passkey,
      privateName,
    );
  });
});

test("audit.action-account-passkey-delete", async ({ page }) => {
  await withPasskey(page, async (fixture) => {
    const passkey = await withE2ePrisma((db) =>
      db.passkey.findFirstOrThrow({ where: { userId: fixture.user.id } }),
    );
    const password = await hashPassword(`backup-${crypto.randomUUID()}`);
    await withE2ePrisma((db) =>
      db.account.create({
        data: {
          userId: fixture.user.id,
          provider: "credential",
          issuer: createLocalAccountIssuer("credential"),
          providerAccountId: fixture.user.id,
          password,
        },
      }),
    );
    const response = await page.request.post(
      "/api/auth/passkey/delete-passkey",
      { data: { id: passkey.id }, headers: { origin: PLAYWRIGHT_BASE_URL } },
    );
    expect(response.status()).toBe(200);
    expect(
      await withE2ePrisma((db) =>
        db.passkey.findUnique({ where: { id: passkey.id } }),
      ),
    ).toBeNull();
    expect(
      await withE2ePrisma((db) =>
        db.passkey.count({ where: { userId: fixture.user.id } }),
      ),
    ).toBe(0);
    await expectPasskeyAudit(
      fixture,
      "account_passkey_delete",
      passkey,
      "Private registration name",
    );
  });
});

test("audit.action-account-sign-in", async ({ page }) => {
  await withPasskey(page, async (fixture) => {
    const signOut = await page.request.post("/api/auth/sign-out", {
      data: {},
      headers: { origin: PLAYWRIGHT_BASE_URL },
    });
    expect(signOut.status()).toBe(200);
    await expect
      .poll(
        async () => (await rowsFor(fixture.user.id, "account_sign_out")).length,
      )
      .toBe(1);
    expect(
      await withE2ePrisma((db) =>
        db.session.count({ where: { userId: fixture.user.id } }),
      ),
    ).toBe(0);
    await gotoAndWaitForReady(
      page,
      "/account/sign-in?callbackUrl=%2Faccount%2Fsettings%2Faccounts",
    );
    await page
      .getByRole("button", { name: /使用通行密钥登录|Sign in with a passkey/i })
      .click();
    await expect(page).toHaveURL(/\/account\/settings\/accounts$/);
    const sessions = await withE2ePrisma((db) =>
      db.session.findMany({ where: { userId: fixture.user.id } }),
    );
    expect(sessions).toHaveLength(1);
    await expect
      .poll(
        async () => (await rowsFor(fixture.user.id, "account_sign_in")).length,
      )
      .toBe(1);
    const rows = await rowsFor(fixture.user.id, "account_sign_in");
    expect(rows[0]).toMatchObject({
      outcome: "success",
      userId: fixture.user.id,
      subjectUserId: fixture.user.id,
      sessionId: sessions[0].id,
    });
    expect(JSON.stringify(rows)).not.toContain(sessions[0].sessionToken);
    expect(JSON.stringify(rows)).not.toContain("Private registration name");
  });
});

test("audit.action-account-session-revoke", async ({ page }) => {
  const fixture = await signedUser(page);
  try {
    const active = await withE2ePrisma((db) =>
      db.session.findFirstOrThrow({ where: { userId: fixture.user.id } }),
    );
    await createSignedSessionCookie(fixture.user.id);
    const revoked = await withE2ePrisma((db) =>
      db.session.findFirstOrThrow({
        where: { userId: fixture.user.id, id: { not: active.id } },
      }),
    );
    const response = await page.request.post("/api/auth/revoke-session", {
      data: { token: revoked.sessionToken },
      headers: { origin: PLAYWRIGHT_BASE_URL },
    });
    expect(response.status()).toBe(200);
    expect(
      await withE2ePrisma((db) =>
        db.session.findUnique({ where: { id: revoked.id } }),
      ),
    ).toBeNull();
    expect(
      await withE2ePrisma((db) =>
        db.session.count({ where: { id: active.id } }),
      ),
    ).toBe(1);
    await expect
      .poll(
        async () =>
          (await rowsFor(fixture.user.id, "account_session_revoke")).length,
      )
      .toBe(1);
    const rows = await rowsFor(fixture.user.id, "account_session_revoke");
    expect(rows[0]).toMatchObject({
      outcome: "success",
      targetId: revoked.id,
      targetType: "session",
      userId: fixture.user.id,
      subjectUserId: fixture.user.id,
    });
    for (const secret of [
      active.sessionToken,
      revoked.sessionToken,
      fixture.cookie.value,
    ])
      expect(JSON.stringify(rows)).not.toContain(secret);
  } finally {
    await fixture.cleanup();
  }
});

test("audit.action-account-credential-update", async ({ page }) => {
  const fixture = await signedUser(page);
  const oldPassword = `Old-${crypto.randomUUID()}`;
  const newPassword = `New-${crypto.randomUUID()}`;
  const oldHash = await hashPassword(oldPassword);
  try {
    const account = await withE2ePrisma((db) =>
      db.account.create({
        data: {
          userId: fixture.user.id,
          provider: "credential",
          issuer: createLocalAccountIssuer("credential"),
          providerAccountId: fixture.user.id,
          password: oldHash,
        },
      }),
    );
    const changed = await page.request.post("/api/auth/change-password", {
      data: {
        currentPassword: oldPassword,
        newPassword,
        revokeOtherSessions: false,
      },
      headers: { origin: PLAYWRIGHT_BASE_URL },
    });
    expect(changed.status()).toBe(200);
    const saved = await withE2ePrisma((db) =>
      db.account.findUniqueOrThrow({ where: { id: account.id } }),
    );
    expect(saved.password).not.toBe(oldHash);
    await expect
      .poll(
        async () =>
          (await rowsFor(fixture.user.id, "account_credential_update")).length,
      )
      .toBe(1);
    const rows = await rowsFor(fixture.user.id, "account_credential_update");
    expect(rows[0]).toMatchObject({
      outcome: "success",
      targetId: account.id,
      userId: fixture.user.id,
      subjectUserId: fixture.user.id,
      metadata: { changedFields: ["password"] },
    });
    for (const secret of [
      oldPassword,
      newPassword,
      oldHash,
      saved.password,
      fixture.cookie.value,
    ])
      expect(JSON.stringify(rows)).not.toContain(secret);
    const signIn = (password: string) =>
      page.request.post("/api/auth/sign-in/email", {
        data: { email: fixture.user.email, password },
        headers: { origin: PLAYWRIGHT_BASE_URL },
      });
    expect((await signIn(oldPassword)).status()).toBe(401);
    expect((await signIn(newPassword)).status()).toBe(200);
    await expect
      .poll(
        async () =>
          (await rowsFor(fixture.user.id, "account_sign_in")).filter(
            ({ outcome }) => outcome === "success",
          ).length,
      )
      .toBe(1);
  } finally {
    await fixture.cleanup();
  }
});
