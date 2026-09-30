import { type APIRequestContext, expect, type Page } from "@playwright/test";
import type { Session } from "@/generated/prisma-node/client";
import type { CalendarProtocol } from "../../../utils/calendar-protocol-lifecycle";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createUploadBucket } from "../../../utils/upload-bucket";
import { test } from "../api/mcp/_fixture";

type AccountDatabase = IsolatedWorker["database"]["owner"];
async function accountFixture(
  page: Page,
  worker: IsolatedWorker,
  io: CalendarProtocol,
  linkedAccounts = false,
) {
  const username = `policy${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const { user, accounts } = await worker.database.owner.$transaction(
    async (db) => {
      const user = await db.user.create({
        data: {
          id: crypto.randomUUID(),
          username,
          email: `${username}@example.test`,
          emailVerified: true,
          name: `Private ${username}`,
        },
      });
      const accounts = [];
      if (linkedAccounts)
        for (const [provider, issuer, prefix] of [
          ["github", "https://github.com", "github"],
          ["disabled-provider", "https://disabled.example", "disabled"],
        ])
          accounts.push(
            await db.account.create({
              data: {
                userId: user.id,
                provider,
                providerAccountId: `${prefix}-${user.id}`,
                issuer,
              },
            }),
          );
      return { user, accounts };
    },
  );
  const actor = await worker.createSession(user.id);
  const session = await worker.database.owner.session.findFirstOrThrow({
    where: { userId: user.id },
  });
  await page.context().addCookies([actor.cookie]);
  await io.observeCalendar(user, [], { calendar: "absent" });
  return { user, accounts, cookie: actor.cookie, session, started: Date.now() };
}
async function expectRefreshedSession(
  db: AccountDatabase,
  initial: Session,
  started: number,
  finished: number,
) {
  const sessions = await db.session.findMany();
  expect(sessions).toEqual([
    { ...initial, expires: expect.any(Date), updatedAt: expect.any(Date) },
  ]);
  const expiryClock = sessions[0].expires.getTime() - 30 * 86400_000;
  for (const time of [expiryClock, sessions[0].updatedAt.getTime()]) {
    expect(time).toBeGreaterThanOrEqual(started);
    expect(time).toBeLessThanOrEqual(finished);
  }
  expect(sessions[0].updatedAt.getTime()).toBeGreaterThanOrEqual(expiryClock);
  expect(sessions[0].expires.getTime()).toBeGreaterThan(
    initial.expires.getTime(),
  );
}
async function expectUnusedAccountFeatures(
  db: AccountDatabase,
  request: APIRequestContext,
  origin: string,
  userId: string,
) {
  expect(await db.oAuthClient.count()).toBe(0);
  expect(await db.oAuthConsent.count()).toBe(0);
  expect(await db.oAuthAccessToken.count()).toBe(0);
  expect(await db.oAuthRefreshToken.count()).toBe(0);
  expect(await db.oAuthGrantUsageDaily.count()).toBe(0);
  expect(await db.deviceCode.count()).toBe(0);
  expect(await db.verificationToken.count()).toBe(0);
  expect(await db.verifiedEmail.count()).toBe(0);
  expect(await db.userSuspension.count()).toBe(0);
  expect(await db.upload.count()).toBe(0);
  expect(await db.uploadPending.count()).toBe(0);
  expect(await db.userSectionSubscription.count()).toBe(0);
  expect(await db.todo.count()).toBe(0);
  expect(
    await createUploadBucket(request, origin).list({
      prefix: `uploads/${userId}/`,
    }),
  ).toEqual({ objects: [], truncated: false });
}
const auditSelect = {
  action: true,
  outcome: true,
  channel: true,
  userId: true,
  subjectUserId: true,
  targetId: true,
  targetType: true,
  sessionId: true,
  oauthClientId: true,
  oauthGrantId: true,
  metadata: true,
} as const;
async function expectDeletedAccount(
  db: AccountDatabase,
  fixture: Awaited<ReturnType<typeof accountFixture>>,
) {
  expect(await db.user.findMany()).toEqual([]);
  expect(await db.session.findMany()).toEqual([]);
  expect(await db.account.findMany()).toEqual([]);
  expect(await db.passkey.findMany()).toEqual([]);
  expect(await db.auditLog.findMany({ select: auditSelect })).toEqual([
    {
      action: "account_delete",
      outcome: "success",
      channel: "web",
      userId: null,
      subjectUserId: null,
      targetId: null,
      targetType: "user",
      sessionId: fixture.session.id,
      oauthClientId: null,
      oauthGrantId: null,
      metadata: { selfService: true },
    },
  ]);
  const serialized = JSON.stringify(await db.auditLog.findMany());
  for (const secret of [
    fixture.user.id,
    fixture.user.username,
    fixture.user.email,
    fixture.user.name,
    fixture.cookie.value,
    fixture.session.sessionToken,
  ])
    expect(serialized).not.toContain(secret);
}
async function openDeletion(page: Page) {
  await gotoAndWaitForReady(page, "/account/settings/danger");
  await page
    .locator("[data-settings-danger-region]")
    .getByRole("button", { name: /删除|Delete/i })
    .click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  return {
    dialog,
    input: dialog.getByPlaceholder("DELETE"),
    confirm: dialog.getByRole("button", { name: /删除|Delete/i }),
  };
}
async function deleteAccount(page: Page) {
  const { input, confirm } = await openDeletion(page);
  await input.fill("DELETE");
  await confirm.click();
  await expect(page).toHaveURL(/\/$/);
}
async function renameAccount(page: Page, newUsername: string) {
  await gotoAndWaitForReady(page, "/account/settings/profile");
  await page.locator("input#username").fill(newUsername);
  await page.getByRole("button", { name: /保存|Save/i }).click();
  await expect(
    page
      .locator("[data-sonner-toast]")
      .filter({ hasText: /成功|Success|updated successfully/i }),
  ).toBeVisible();
}

test("cases.account.account-deletion-1", async ({
  page,
  request,
  isolatedWorker,
  calendarProtocolRun,
}) => {
  await calendarProtocolRun(async (io) => {
    const db = isolatedWorker.database.owner;
    const fixture = await accountFixture(page, isolatedWorker, io);
    const user = fixture.user;
    const posts: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().includes("deleteAccount")
      )
        posts.push(request.url());
    });
    const { input, confirm, dialog } = await openDeletion(page);
    for (const value of ["", "DEL", "delete", " DELETE", "DELETE "]) {
      await input.fill(value);
      await expect(confirm).toBeDisabled();
      await input.press("Enter");
      await expect(dialog).toBeVisible();
      expect(posts).toEqual([]);
    }
    await input.fill("DELETE");
    await expect(confirm).toBeEnabled();
    await dialog.getByRole("button", { name: /取消|Cancel/i }).click();
    await expect(dialog).toBeHidden();
    expect(posts).toEqual([]);
    expect(await db.user.count({ where: { id: user.id } })).toBe(1);
    const finished = Date.now();
    return {
      async verifyTransport({ effects, sdkRequests }) {
        expect(sdkRequests).toEqual([]);
        expect(
          effects.requests.filter(
            ({ value }) => !["GET", "HEAD"].includes(value.method),
          ),
        ).toEqual([]);
      },
      async verifyState() {
        expect(await db.user.findMany()).toEqual([user]);
        await expectRefreshedSession(
          db,
          fixture.session,
          fixture.started,
          finished,
        );
        expect(await db.account.findMany()).toEqual([]);
        expect(await db.passkey.findMany()).toEqual([]);
        expect(await db.auditLog.findMany()).toEqual([]);
        await expectUnusedAccountFeatures(
          db,
          request,
          isolatedWorker.origin,
          user.id,
        );
      },
    };
  });
});

test("cases.account.account-deletion-2", async ({
  page,
  request,
  isolatedWorker,
  calendarProtocolRun,
}) => {
  await calendarProtocolRun(
    async (io) => {
      const db = isolatedWorker.database.owner;
      const fixture = await accountFixture(page, isolatedWorker, io);
      const user = fixture.user;
      await deleteAccount(page);
      await expect(
        page
          .locator("[data-shell-topbar]")
          .getByRole("link", { name: /^(登录|Sign in)$/i }),
      ).toBeVisible();
      await expect(page.locator("#app-user-menu")).toHaveCount(0);
      const session = await page.request.get("/api/auth/get-session");
      expect(await session.json()).toBeNull();
      expect(await db.user.count({ where: { id: user.id } })).toBe(0);
      return {
        async verifyTransport({ effects, sdkRequests }) {
          expect(sdkRequests).toEqual([]);
          expect(
            effects.requests
              .filter(({ value }) => !["GET", "HEAD"].includes(value.method))
              .map(({ value, result }) => [value.method, value.path, result]),
          ).toEqual([["POST", "/account/settings/danger", 200]]);
        },
        async verifyState() {
          await expectDeletedAccount(db, fixture);
          await expectUnusedAccountFeatures(
            db,
            request,
            isolatedWorker.origin,
            user.id,
          );
        },
      };
    },
    async (response, incoming) => {
      expect(incoming.method()).toBe("POST");
      expect(new URL(incoming.url()).pathname).toBe("/account/settings/danger");
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        type: "redirect",
        status: 303,
        location: "/",
      });
    },
  );
});

test("cases.account.deleted-session-revocation", async ({
  page,
  request,
  isolatedWorker,
  calendarProtocolRun,
}) => {
  await calendarProtocolRun(
    async (io) => {
      const db = isolatedWorker.database.owner;
      const fixture = await accountFixture(page, isolatedWorker, io);
      const user = fixture.user;
      const secondCookie = (await isolatedWorker.createSession(user.id)).cookie;
      const replayGet = async (
        path: string,
        options: Parameters<APIRequestContext["get"]>[1] = {},
      ) => {
        const response = await io.request.get(path, {
          ...options,
          headers: {
            ...options.headers,
            cookie: `${secondCookie.name}=${secondCookie.value}`,
          },
        });
        await response.body();
        return response;
      };
      expect(
        (await (await replayGet("/api/auth/get-session")).json()).user.id,
      ).toBe(user.id);
      await deleteAccount(page);
      expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
      expect(
        await (await replayGet("/api/auth/get-session")).json(),
      ).toBeNull();
      expect((await replayGet("/api/workspace/todos")).status()).toBe(401);
      const workspace = await replayGet("/workspace/todos", {
        maxRedirects: 0,
      });
      expect(workspace.status()).toBe(303);
      expect(workspace.headers().location).toContain("/account/sign-in");
      return {
        async verifyTransport({ effects, sdkRequests }) {
          expect(sdkRequests).toEqual([]);
          expect(
            effects.requests
              .filter(
                ({ value }) =>
                  value.method === "GET" &&
                  value.path === "/api/workspace/todos",
              )
              .map(({ result }) => result),
          ).toEqual([401]);
          expect(
            effects.requests
              .filter(
                ({ value }) =>
                  value.method === "GET" && value.path === "/workspace/todos",
              )
              .map(({ result }) => result),
          ).toEqual([303]);
          expect(
            effects.requests
              .filter(({ value }) => !["GET", "HEAD"].includes(value.method))
              .map(({ value, result }) => [value.method, value.path, result]),
          ).toEqual([["POST", "/account/settings/danger", 200]]);
        },
        async verifyState() {
          await expectDeletedAccount(db, fixture);
          await expectUnusedAccountFeatures(
            db,
            request,
            isolatedWorker.origin,
            user.id,
          );
        },
      };
    },
    async (response, incoming) => {
      expect(incoming.method()).toBe("POST");
      expect(new URL(incoming.url()).pathname).toBe("/account/settings/danger");
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        type: "redirect",
        status: 303,
        location: "/",
      });
    },
  );
});

test("cases.account.username-change-2", async ({
  page,
  request,
  isolatedWorker,
  calendarProtocolRun,
}) => {
  await calendarProtocolRun(
    async (io) => {
      const db = isolatedWorker.database.owner;
      const fixture = await accountFixture(page, isolatedWorker, io);
      const user = fixture.user;
      const get = async (...args: Parameters<APIRequestContext["get"]>) => {
        const response = await page.request.get(...args);
        await response.body();
        return response;
      };
      const newUsername = `${user.username?.slice(0, -3)}new`;
      expect(
        (await get(`/api/community/users/${user.username}`)).status(),
      ).toBe(200);
      await renameAccount(page, newUsername);
      expect(
        await db.user.findUnique({
          where: { id: user.id },
          select: { username: true },
        }),
      ).toEqual({ username: newUsername });
      expect(
        (
          await get(`/api/community/users/${user.username}`, {
            maxRedirects: 0,
          })
        ).status(),
      ).toBe(404);
      const oldPage = await get(`/community/users/${user.username}`, {
        maxRedirects: 0,
      });
      expect(oldPage.status()).toBe(404);
      const current = await get(`/api/community/users/${newUsername}`);
      expect(current.status()).toBe(200);
      expect((await current.json()).user).toMatchObject({
        id: user.id,
        username: newUsername,
      });
      const finished = Date.now();
      return {
        async verifyTransport({ effects, sdkRequests }) {
          expect(sdkRequests).toEqual([]);
          expect(
            effects.requests
              .filter(({ value }) => !["GET", "HEAD"].includes(value.method))
              .map(({ value, result }) => [value.method, value.path, result]),
          ).toEqual([["POST", "/account/settings/profile", 200]]);
          for (const [path, statuses] of [
            [`/api/community/users/${user.username}`, [200, 404]],
            [`/community/users/${user.username}`, [404]],
            [`/api/community/users/${newUsername}`, [200]],
          ] as const)
            expect(
              effects.requests
                .filter(
                  ({ value }) => value.method === "GET" && value.path === path,
                )
                .map(({ result }) => result),
            ).toEqual(statuses);
        },
        async verifyState() {
          const users = await db.user.findMany();
          expect(users).toEqual([
            { ...user, username: newUsername, updatedAt: expect.any(Date) },
          ]);
          expect(users[0].updatedAt.getTime()).toBeGreaterThanOrEqual(
            fixture.started,
          );
          expect(users[0].updatedAt.getTime()).toBeLessThanOrEqual(finished);
          await expectRefreshedSession(
            db,
            fixture.session,
            fixture.started,
            finished,
          );
          expect(await db.account.findMany()).toEqual([]);
          expect(await db.passkey.findMany()).toEqual([]);
          expect(await db.auditLog.findMany({ select: auditSelect })).toEqual([
            {
              action: "account_profile_update",
              outcome: "success",
              channel: "auth",
              userId: user.id,
              subjectUserId: user.id,
              targetId: user.id,
              targetType: "user",
              sessionId: null,
              oauthClientId: null,
              oauthGrantId: null,
              metadata: { changedFields: ["name", "username"] },
            },
          ]);
          const audits = JSON.stringify(await db.auditLog.findMany());
          for (const secret of [
            user.username,
            newUsername,
            user.email,
            user.name,
            fixture.cookie.value,
          ])
            expect(audits).not.toContain(secret);
          await expectUnusedAccountFeatures(
            db,
            request,
            isolatedWorker.origin,
            user.id,
          );
        },
      };
    },
    async (response, incoming) => {
      expect(incoming.method()).toBe("POST");
      expect(new URL(incoming.url()).pathname).toBe(
        "/account/settings/profile",
      );
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        type: "redirect",
        status: 303,
        location: "/account/settings/profile?message=Success",
      });
    },
  );
});

test("cases.account.oauth-connection-error-2", async ({
  page,
  request,
  isolatedWorker,
  calendarProtocolRun,
}) => {
  test.setTimeout(90_000);
  await calendarProtocolRun(
    async (io) => {
      const db = isolatedWorker.database.owner;
      const fixture = await accountFixture(page, isolatedWorker, io, true);
      const user = fixture.user;
      const [account, disabled] = fixture.accounts;
      const post = async (...args: Parameters<APIRequestContext["post"]>) => {
        const response = await page.request.post(...args);
        await response.body();
        return response;
      };
      const cdp = await page.context().newCDPSession(page);
      let authenticatorId: string | undefined;
      try {
        await cdp.send("WebAuthn.enable");
        ({ authenticatorId } = await cdp.send(
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
        ));
        await gotoAndWaitForReady(page, "/account/settings/accounts");
        const github = page.getByRole("listitem").filter({ hasText: "GitHub" });
        await expect(
          github.getByRole("button", { name: /断开连接|Disconnect/i }),
        ).toBeDisabled();
        await expect(
          github.getByText(
            /至少保留一种可用的登录方式|at least one usable sign-in method/i,
          ),
        ).toBeVisible();
        const denied = await page.request.post("/api/auth/unlink-account", {
          data: { accountId: account.id },
          headers: { origin: new URL(page.url()).origin },
        });
        await denied.body();
        expect(denied.status()).toBe(400);
        expect(await db.account.count({ where: { id: account.id } })).toBe(1);

        const passkeys = page.locator("[data-passkey-settings]");
        await passkeys
          .getByLabel(/通行密钥名称|Passkey name/i)
          .fill("Policy key");
        await passkeys
          .getByRole("button", { name: /添加通行密钥|Add passkey/i })
          .click();
        await expect(
          passkeys.getByLabel(/重命名 Policy key|Rename Policy key/i),
        ).toHaveValue("Policy key");
        const registered = await db.passkey.findFirstOrThrow({
          where: { userId: user.id },
        });
        const registrationFinished = Date.now();
        await expect(
          github.getByRole("button", { name: /断开连接|Disconnect/i }),
        ).toBeEnabled();
        await github
          .getByRole("button", { name: /断开连接|Disconnect/i })
          .click();
        await page
          .getByRole("alertdialog")
          .getByRole("button", { name: /断开连接|Disconnect/i })
          .click();
        await expect
          .poll(() => db.account.count({ where: { id: account.id } }))
          .toBe(0);

        await page.locator("#app-user-menu").getByRole("button").click();
        await page.getByRole("menuitem", { name: /登出|Sign Out/i }).click();
        await expect(page).toHaveURL(/\/(?:\?.*)?$/);
        await gotoAndWaitForReady(
          page,
          "/account/sign-in?callbackUrl=%2Faccount%2Fsettings%2Faccounts",
        );
        const signInStarted = Date.now();
        await page
          .getByRole("button", {
            name: /使用通行密钥登录|Sign in with a passkey/i,
          })
          .click();
        await expect(page).toHaveURL(/\/account\/settings\/accounts(?:\?.*)?$/);
        expect(
          (await (await page.request.get("/api/auth/get-session")).json()).user
            .id,
        ).toBe(user.id);
        const signInFinished = Date.now();
        const key = await db.passkey.findFirstOrThrow({
          where: { userId: user.id },
        });
        expect(
          (
            await post("/api/auth/passkey/delete-passkey", {
              data: { id: key.id },
              headers: { origin: new URL(page.url()).origin },
            })
          ).status(),
        ).toBe(400);
        await expect
          .poll(() =>
            db.auditLog.count({
              where: { userId: user.id, action: "account_passkey_delete" },
            }),
          )
          .toBeGreaterThan(0);
        const signedInSessions = await db.session.findMany();
        expect(signedInSessions).toHaveLength(1);
        const signedIn = signedInSessions[0];
        expect(signedIn.id).not.toBe(fixture.session.id);
        expect(signedIn.userId).toBe(user.id);
        for (const time of [
          signedIn.createdAt.getTime(),
          signedIn.expires.getTime() - 30 * 86400_000,
        ]) {
          expect(time).toBeGreaterThanOrEqual(signInStarted);
          expect(time).toBeLessThanOrEqual(signInFinished);
        }
        const credentials = await cdp.send("WebAuthn.getCredentials", {
          authenticatorId,
        });
        expect(credentials.credentials).toHaveLength(1);
        expect(
          Buffer.from(
            credentials.credentials[0].credentialId,
            "base64",
          ).toString("base64url"),
        ).toBe(key.credentialID);
        expect(key.counter).toBe(credentials.credentials[0].signCount);
        expect(key.counter).toBeGreaterThan(registered.counter);
        return {
          async verifyTransport({ effects, sdkRequests }) {
            expect(sdkRequests).toEqual([]);
            expect(
              effects.requests
                .filter(({ value }) => !["GET", "HEAD"].includes(value.method))
                .map(({ value, result }) => [value.method, value.path, result]),
            ).toEqual([
              ["POST", "/api/auth/unlink-account", 400],
              ["POST", "/api/auth/passkey/verify-registration", 200],
              ["POST", "/account/settings/accounts", 200],
              ["POST", "/api/auth/sign-out", 200],
              ["POST", "/api/auth/passkey/verify-authentication", 200],
              ["POST", "/api/auth/passkey/delete-passkey", 400],
            ]);
            for (const path of [
              "/api/auth/passkey/generate-register-options",
              "/api/auth/passkey/generate-authenticate-options",
            ])
              expect(
                effects.requests
                  .filter(
                    ({ value }) =>
                      value.method === "GET" && value.path === path,
                  )
                  .map(({ result }) => result),
              ).toEqual([200]);
          },
          async verifyState() {
            expect(await db.user.findMany()).toEqual([user]);
            expect(await db.account.findMany()).toEqual([disabled]);
            expect(await db.session.findMany()).toEqual(signedInSessions);
            expect(await db.passkey.findMany()).toEqual([
              { ...registered, counter: key.counter },
            ]);
            expect(registered).toMatchObject({
              userId: user.id,
              name: "Policy key",
              credentialID: expect.any(String),
              publicKey: expect.any(String),
            });
            expect(registered.publicKey.length).toBeGreaterThan(0);
            expect(registered.credentialID.length).toBeGreaterThan(0);
            expect(registered.createdAt?.getTime()).toBeGreaterThanOrEqual(
              fixture.started,
            );
            expect(registered.createdAt?.getTime()).toBeLessThanOrEqual(
              registrationFinished,
            );
            const rows = await db.auditLog.findMany({ select: auditSelect });
            const common = {
              userId: user.id,
              subjectUserId: user.id,
              oauthClientId: null,
              oauthGrantId: null,
              sessionId: null,
              targetId: null,
            };
            const expected = [
              {
                ...common,
                action: "account_unlink",
                outcome: "failure",
                channel: "auth",
                targetType: "account",
                metadata: {},
              },
              {
                ...common,
                action: "account_passkey_create",
                outcome: "success",
                channel: "auth",
                targetId: key.id,
                targetType: "passkey",
                metadata: {},
              },
              {
                ...common,
                action: "account_unlink",
                outcome: "success",
                channel: "web",
                sessionId: fixture.session.id,
                targetType: "account",
                metadata: { provider: "github" },
              },
              {
                ...common,
                action: "account_sign_out",
                outcome: "success",
                channel: "auth",
                sessionId: fixture.session.id,
                targetId: fixture.session.id,
                targetType: "session",
                metadata: null,
              },
              {
                ...common,
                action: "account_sign_in",
                outcome: "success",
                channel: "auth",
                sessionId: signedIn.id,
                targetId: signedIn.id,
                targetType: "session",
                metadata: { authMethod: "passkey" },
              },
              {
                ...common,
                action: "account_passkey_delete",
                outcome: "failure",
                channel: "auth",
                targetId: key.id,
                targetType: "passkey",
                metadata: {},
              },
            ];
            expect(rows).toHaveLength(expected.length);
            expect(rows).toEqual(expect.arrayContaining(expected));
            const serialized = JSON.stringify(await db.auditLog.findMany());
            for (const secret of [
              user.email,
              user.name,
              fixture.cookie.value,
              fixture.session.sessionToken,
              signedIn.sessionToken,
              key.publicKey,
              key.credentialID,
              "Policy key",
            ])
              expect(serialized).not.toContain(secret);
            await expectUnusedAccountFeatures(
              db,
              request,
              isolatedWorker.origin,
              user.id,
            );
          },
        };
      } finally {
        try {
          if (authenticatorId)
            await cdp.send("WebAuthn.removeVirtualAuthenticator", {
              authenticatorId,
            });
          await cdp.send("WebAuthn.disable");
        } finally {
          await cdp.detach();
        }
      }
    },
    async (response, incoming) => {
      expect(incoming.method()).toBe("POST");
      expect(response.status()).toBe(200);
      await response.body();
      const path = new URL(incoming.url()).pathname;
      expect([
        "/api/auth/passkey/verify-registration",
        "/account/settings/accounts",
        "/api/auth/sign-out",
        "/api/auth/passkey/verify-authentication",
      ]).toContain(path);
      if (path === "/account/settings/accounts")
        expect(await response.json()).toMatchObject({
          type: "redirect",
          status: 303,
          location: "/account/settings/accounts?message=AccountDisconnected",
        });
    },
  );
});
