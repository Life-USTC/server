import { readFile } from "node:fs/promises";
import { createLocalAccountIssuer } from "@better-auth/core/db";
import { expect } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import type { AuditAction } from "@/generated/prisma/client";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { type AccountAudit, test } from "./account-audit-fixture";

test("audit.action-account-calendar-token-create", async ({
  accountAuditRun,
  page,
  accountAudit: fixture,
}) => {
  await accountAuditRun(
    {
      browser: [],
      native: [],
      audits: [["account_calendar_token_create", "success"]],
    },
    async () => {
      expect((await fixture.token()).calendarFeedToken).toBeNull();
      for (let request = 0; request < 2; request++) {
        const response = await page.request.get("/workspace/subscriptions");
        expect(response.status()).toBe(200);
      }
      const token = (await fixture.token()).calendarFeedToken;
      expect(token).toBeTruthy();
      await expect
        .poll(
          async () =>
            (await fixture.events("account_calendar_token_create")).length,
        )
        .toBe(1);
      const rows = await fixture.events("account_calendar_token_create");
      expect(rows[0]).toMatchObject({
        outcome: "success",
        targetType: "calendar_feed",
        targetId: fixture.user.id,
        subjectUserId: fixture.user.id,
      });
      expect(JSON.stringify(rows)).not.toContain(token);
      expect(JSON.stringify(rows)).not.toContain(fixture.cookie.value);
      expect(JSON.stringify(rows)).not.toContain(fixture.user.email);
    },
  );
});

test("audit.action-account-calendar-token-rotate", async ({
  accountAuditRun,
  page,
  accountAudit: fixture,
}) => {
  await accountAuditRun(
    {
      browser: [],
      native: [
        ["POST", "/account/settings/security", 403],
        ["POST", "/account/settings/security", 500],
        ["POST", "/account/settings/security", 303],
      ],
      audits: [
        ["account_calendar_token_rotate", "denied"],
        ["account_calendar_token_rotate", "failure"],
        ["account_calendar_token_rotate", "success"],
      ],
    },
    async () => {
      const constraint = `audit_token_${crypto.randomUUID().replaceAll("-", "")}`;
      const oldToken = crypto.randomUUID();
      const privateMarker = `private-body-${crypto.randomUUID()}`;

      async function rotate() {
        return page.request.post(
          "/account/settings/security?/rotateCalendarToken",
          {
            form: { privateMarker },
            headers: { origin: fixture.origin, accept: "text/html" },
            maxRedirects: 0,
          },
        );
      }

      await fixture.db.user.update({
        where: { id: fixture.user.id },
        data: { calendarFeedToken: oldToken },
      });
      await fixture.db.session.updateMany({
        where: { userId: fixture.user.id },
        data: { createdAt: new Date("2000-01-01T00:00:00Z") },
      });

      const denied = await rotate();
      expect(denied.status(), denied.headers().location).toBe(403);
      expect((await fixture.token()).calendarFeedToken).toBe(oldToken);

      await fixture.db.session.updateMany({
        where: { userId: fixture.user.id },
        data: { createdAt: new Date() },
      });
      await fixture.db.$executeRawUnsafe(
        `ALTER TABLE public."User" ADD CONSTRAINT "${constraint}" CHECK ("id" <> '${fixture.user.id.replaceAll("'", "''")}' OR "calendarFeedToken" = '${oldToken}') NOT VALID`,
      );

      expect((await rotate()).status()).toBe(500);
      expect((await fixture.token()).calendarFeedToken).toBe(oldToken);
      await fixture.db.$executeRawUnsafe(
        `ALTER TABLE public."User" DROP CONSTRAINT "${constraint}"`,
      );

      const success = await rotate();
      expect(success.status()).toBe(303);
      expect(success.headers().location).toContain(
        "message=CalendarTokenRotated",
      );
      const newToken = (await fixture.token()).calendarFeedToken;
      expect(newToken).toBeTruthy();
      expect(newToken).not.toBe(oldToken);
      await expect
        .poll(
          async () =>
            (await fixture.events("account_calendar_token_rotate")).length,
        )
        .toBe(3);
      const rows = await fixture.events("account_calendar_token_rotate");
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
    },
  );
});

async function expectPasskeyAudit(
  fixture: AccountAudit,
  action: AuditAction,
  passkey: { id: string; credentialID: string; publicKey: string },
  privateName: string,
) {
  await expect.poll(async () => (await fixture.events(action)).length).toBe(1);
  const rows = await fixture.events(action);
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

test("audit.action-account-passkey-create", async ({
  accountAuditRun,
  accountAudit: fixture,
  passkeyAudit,
}) => {
  await accountAuditRun(
    {
      browser: [["POST", "/api/auth/passkey/verify-registration", 200]],
      native: [["POST", "/api/auth/passkey/verify-registration", 200]],
      audits: [["account_passkey_create", "success"]],
    },
    () =>
      passkeyAudit(async () => {
        const passkey = await fixture.db.passkey.findFirstOrThrow({
          where: { userId: fixture.user.id },
        });
        expect(passkey.publicKey.length).toBeGreaterThan(0);
        expect(passkey.credentialID.length).toBeGreaterThan(0);
        await expectPasskeyAudit(
          fixture,
          "account_passkey_create",
          passkey,
          "Private registration name",
        );
      }),
  );
});

test("audit.action-account-passkey-update", async ({
  accountAuditRun,
  page,
  accountAudit: fixture,
  passkeyAudit,
}) => {
  await accountAuditRun(
    {
      browser: [["POST", "/api/auth/passkey/verify-registration", 200]],
      native: [
        ["POST", "/api/auth/passkey/verify-registration", 200],
        ["POST", "/api/auth/passkey/update-passkey", 200],
      ],
      audits: [
        ["account_passkey_create", "success"],
        ["account_passkey_update", "success"],
      ],
    },
    () =>
      passkeyAudit(async () => {
        const passkey = await fixture.db.passkey.findFirstOrThrow({
          where: { userId: fixture.user.id },
        });
        const privateName = "Private updated passkey name";
        const response = await page.request.post(
          "/api/auth/passkey/update-passkey",
          {
            data: { id: passkey.id, name: privateName },
            headers: { origin: fixture.origin },
          },
        );
        expect(response.status()).toBe(200);
        expect(
          await fixture.db.passkey.findUniqueOrThrow({
            where: { id: passkey.id },
          }),
        ).toMatchObject({ name: privateName });
        await expectPasskeyAudit(
          fixture,
          "account_passkey_update",
          passkey,
          privateName,
        );
      }),
  );
});

test("audit.action-account-passkey-delete", async ({
  accountAuditRun,
  page,
  accountAudit: fixture,
  passkeyAudit,
}) => {
  await accountAuditRun(
    {
      browser: [["POST", "/api/auth/passkey/verify-registration", 200]],
      native: [
        ["POST", "/api/auth/passkey/verify-registration", 200],
        ["POST", "/api/auth/passkey/delete-passkey", 200],
      ],
      audits: [
        ["account_passkey_create", "success"],
        ["account_passkey_delete", "success"],
      ],
    },
    () =>
      passkeyAudit(async () => {
        const passkey = await fixture.db.passkey.findFirstOrThrow({
          where: { userId: fixture.user.id },
        });
        const password = await hashPassword(`backup-${crypto.randomUUID()}`);
        await fixture.db.account.create({
          data: {
            userId: fixture.user.id,
            provider: "credential",
            issuer: createLocalAccountIssuer("credential"),
            providerAccountId: fixture.user.id,
            password,
          },
        });
        const response = await page.request.post(
          "/api/auth/passkey/delete-passkey",
          {
            data: { id: passkey.id },
            headers: { origin: fixture.origin },
          },
        );
        expect(response.status()).toBe(200);
        expect(
          await fixture.db.passkey.findUnique({ where: { id: passkey.id } }),
        ).toBeNull();
        expect(
          await fixture.db.passkey.count({
            where: { userId: fixture.user.id },
          }),
        ).toBe(0);
        await expectPasskeyAudit(
          fixture,
          "account_passkey_delete",
          passkey,
          "Private registration name",
        );
      }),
  );
});

test("audit.action-account-sign-in", async ({
  accountAuditRun,
  page,
  accountAudit: fixture,
  passkeyAudit,
}) => {
  await accountAuditRun(
    {
      browser: [
        ["POST", "/api/auth/passkey/verify-registration", 200],
        ["POST", "/api/auth/passkey/verify-authentication", 200],
      ],
      native: [
        ["POST", "/api/auth/passkey/verify-registration", 200],
        ["POST", "/api/auth/sign-out", 200],
        ["POST", "/api/auth/passkey/verify-authentication", 200],
      ],
      audits: [
        ["account_passkey_create", "success"],
        ["account_sign_out", "success"],
        ["account_sign_in", "success"],
      ],
    },
    () =>
      passkeyAudit(async () => {
        const signOut = await page.request.post("/api/auth/sign-out", {
          data: {},
          headers: { origin: fixture.origin },
        });
        expect(signOut.status()).toBe(200);
        await expect
          .poll(async () => (await fixture.events("account_sign_out")).length)
          .toBe(1);
        expect(
          await fixture.db.session.count({
            where: { userId: fixture.user.id },
          }),
        ).toBe(0);
        await gotoAndWaitForReady(
          page,
          "/account/sign-in?callbackUrl=%2Faccount%2Fsettings%2Faccounts",
        );
        await page
          .getByRole("button", {
            name: /使用通行密钥登录|Sign in with a passkey/i,
          })
          .click();
        await expect(page).toHaveURL(/\/account\/settings\/accounts$/);
        const sessions = await fixture.db.session.findMany({
          where: { userId: fixture.user.id },
        });
        expect(sessions).toHaveLength(1);
        await expect
          .poll(async () => (await fixture.events("account_sign_in")).length)
          .toBe(1);
        const rows = await fixture.events("account_sign_in");
        expect(rows[0]).toMatchObject({
          outcome: "success",
          userId: fixture.user.id,
          subjectUserId: fixture.user.id,
          sessionId: sessions[0].id,
        });
        expect(JSON.stringify(rows)).not.toContain(sessions[0].sessionToken);
        expect(JSON.stringify(rows)).not.toContain("Private registration name");
      }),
  );
});

test("audit.auth-hook-failure-isolation", async ({
  accountAuditRun,
  page,
  accountAudit: fixture,
  passkeyAudit,
}) => {
  await accountAuditRun(
    {
      browser: [
        ["POST", "/api/auth/passkey/verify-registration", 200],
        ["POST", "/api/auth/passkey/verify-authentication", 200],
      ],
      native: [
        ["POST", "/api/auth/passkey/verify-registration", 200],
        ["POST", "/api/auth/sign-out", 200],
        ["POST", "/api/auth/passkey/verify-authentication", 200],
      ],
      audits: [
        ["account_passkey_create", "success"],
        ["account_sign_out", "success"],
        ["account_sign_in", "success"],
      ],
    },
    () =>
      passkeyAudit(async () => {
        expect(
          (
            await page.request.post("/api/auth/sign-out", {
              data: {},
              headers: { origin: fixture.origin },
            })
          ).status(),
        ).toBe(200);
        const constraint = `auth_audit_${crypto.randomUUID().replaceAll("-", "")}`;
        await fixture.db.$executeRawUnsafe(
          `ALTER TABLE "AuditLog" ADD CONSTRAINT "${constraint}" CHECK ("userId" IS DISTINCT FROM '${fixture.user.id.replaceAll("'", "''")}' OR "action" <> 'account_sign_in') NOT VALID`,
        );
        const logPath = fixture.logPath;
        let signInSessionId: string | undefined;
        try {
          const offset = (await readFile(logPath, "utf8")).length;
          await gotoAndWaitForReady(
            page,
            "/account/sign-in?callbackUrl=%2Faccount%2Fsettings%2Faccounts",
          );
          await page
            .getByRole("button", {
              name: /使用通行密钥登录|Sign in with a passkey/i,
            })
            .click();
          await expect(page).toHaveURL(/\/account\/settings\/accounts$/);
          const sessions = await fixture.db.session.findMany({
            where: { userId: fixture.user.id },
          });
          expect(sessions).toHaveLength(1);
          signInSessionId = sessions[0].id;
          const sessionResponse = await page.request.get(
            "/api/auth/get-session",
          );
          expect(sessionResponse.status()).toBe(200);
          expect(await sessionResponse.json()).toMatchObject({
            user: { id: fixture.user.id },
            session: { id: sessions[0].id },
          });
          const diagnostics = async () =>
            (await readFile(logPath, "utf8")).slice(offset);
          await expect
            .poll(async () =>
              (await diagnostics()).includes("audit-log-write.retry"),
            )
            .toBe(true);
          const log = await diagnostics();
          expect(log).toContain("account_sign_in");
          expect(log).toContain("database_write_failed");
          expect(log).toContain(constraint);
          for (const secret of [
            sessions[0].sessionToken,
            fixture.cookie.value,
            "Private registration name",
            fixture.user.email,
            fixture.user.name,
          ])
            expect(log).not.toContain(secret);
          expect(await fixture.events("account_sign_in")).toHaveLength(0);
          expect(
            await fixture.db.session.findUnique({
              where: { id: sessions[0].id },
            }),
          ).toEqual(sessions[0]);
        } finally {
          await fixture.db.$executeRawUnsafe(
            `ALTER TABLE "AuditLog" DROP CONSTRAINT "${constraint}"`,
          );
          if (signInSessionId) {
            await expect
              .poll(
                async () => (await fixture.events("account_sign_in")).length,
              )
              .toBe(1);
            expect((await fixture.events("account_sign_in"))[0]).toMatchObject({
              sessionId: signInSessionId,
              outcome: "success",
              channel: "auth",
            });
          }
        }
      }),
  );
});

test("audit.action-account-session-revoke", async ({
  accountAuditRun,
  page,
  accountAudit: fixture,
}) => {
  await accountAuditRun(
    {
      browser: [],
      native: [["POST", "/api/auth/revoke-session", 200]],
      audits: [["account_session_revoke", "success"]],
    },
    async () => {
      const active = await fixture.db.session.findFirstOrThrow({
        where: { userId: fixture.user.id },
      });
      await fixture.db.session.create({
        data: {
          userId: fixture.user.id,
          sessionToken: crypto.randomUUID(),
          expires: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const revoked = await fixture.db.session.findFirstOrThrow({
        where: { userId: fixture.user.id, id: { not: active.id } },
      });
      const response = await page.request.post("/api/auth/revoke-session", {
        data: { token: revoked.sessionToken },
        headers: { origin: fixture.origin },
      });
      expect(response.status()).toBe(200);
      expect(
        await fixture.db.session.findUnique({ where: { id: revoked.id } }),
      ).toBeNull();
      expect(await fixture.db.session.count({ where: { id: active.id } })).toBe(
        1,
      );
      await expect
        .poll(
          async () => (await fixture.events("account_session_revoke")).length,
        )
        .toBe(1);
      const rows = await fixture.events("account_session_revoke");
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
    },
  );
});

test("audit.action-account-credential-update", async ({
  accountAuditRun,
  page,
  accountAudit: fixture,
}) => {
  await accountAuditRun(
    {
      browser: [],
      native: [
        ["POST", "/api/auth/change-password", 200],
        ["POST", "/api/auth/sign-in/email", 401],
        ["POST", "/api/auth/sign-in/email", 200],
      ],
      audits: [
        ["account_credential_update", "success"],
        ["account_sign_in", "denied"],
        ["account_sign_in", "success"],
      ],
    },
    async () => {
      const oldPassword = `Old-${crypto.randomUUID()}`;
      const newPassword = `New-${crypto.randomUUID()}`;
      const oldHash = await hashPassword(oldPassword);

      const account = await fixture.db.account.create({
        data: {
          userId: fixture.user.id,
          provider: "credential",
          issuer: createLocalAccountIssuer("credential"),
          providerAccountId: fixture.user.id,
          password: oldHash,
        },
      });
      const changed = await page.request.post("/api/auth/change-password", {
        data: {
          currentPassword: oldPassword,
          newPassword,
          revokeOtherSessions: false,
        },
        headers: { origin: fixture.origin },
      });
      expect(changed.status()).toBe(200);
      const saved = await fixture.db.account.findUniqueOrThrow({
        where: { id: account.id },
      });
      expect(saved.password).not.toBe(oldHash);
      await expect
        .poll(
          async () =>
            (await fixture.events("account_credential_update")).length,
        )
        .toBe(1);
      const rows = await fixture.events("account_credential_update");
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
          headers: { origin: fixture.origin },
        });
      expect((await signIn(oldPassword)).status()).toBe(401);
      expect((await signIn(newPassword)).status()).toBe(200);
      await expect
        .poll(
          async () =>
            (await fixture.events("account_sign_in")).filter(
              ({ outcome }) => outcome === "success",
            ).length,
        )
        .toBe(1);
    },
  );
});
