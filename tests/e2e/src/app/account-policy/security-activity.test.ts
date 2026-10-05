import { expect } from "@playwright/test";
import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { authorizeDeviceBearer } from "../../../utils/oauth-device-bearer";
import { expectOAuthUsage } from "../../../utils/oauth-usage";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../api/mcp/_fixture";

test("user.account-security-activity", { tag: "@Account/Web" }, async ({
  page,
  isolatedWorker,
  calendarProtocolRun,
}) => {
  await calendarProtocolRun(async (io) => {
    const db = isolatedWorker.database.owner;
    const origin = isolatedWorker.origin;
    const marker = `security-view-${crypto.randomUUID()}`;
    const fixture = await db.$transaction(async (db) => {
      const client = await db.oAuthClient.create({
        data: {
          name: marker,
          clientId: crypto.randomUUID(),
          clientSecret: crypto.randomUUID(),
          redirectUris: [`${origin}/oauth-e2e/callback`],
          scopes: ["account.profile:read"],
          grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
          tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
          type: "public",
          disabled: false,
          responseTypes: ["code"],
          requirePKCE: true,
          metadata: { source: "e2e_fixture" },
        },
      });
      const user = await db.user.create({
        data: {
          id: crypto.randomUUID(),
          name: marker,
          username: `sv${crypto.randomUUID().slice(0, 8)}`,
          email: `${marker}@example.test`,
        },
      });
      const other = await db.user.create({
        data: { name: "Other account", email: `other-${marker}@example.test` },
      });
      const name = `<img src=x onerror=alert(1)> ${marker}`;
      const renamedClient = await db.oAuthClient.update({
        where: { clientId: client.clientId },
        data: { name },
      });
      const anchor = Date.now() + 86400_000;
      await db.auditLog.createMany({
        data: Array.from({ length: 21 }, (_, i) => ({
          action: "account_profile_update" as const,
          channel: "web" as const,
          outcome: "success" as const,
          subjectUserId: user.id,
          userId: user.id,
          oauthClientId: client.clientId,
          createdAt: new Date(anchor - i * 60000),
          ipAddress: `203.0.${i}.42`,
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0.1234 Safari/537.36",
          metadata: { privateContent: "never-show-this-account-content" },
          requestId: "private-request-marker",
        })),
      });
      await db.auditLog.create({
        data: {
          action: "account_profile_update",
          subjectUserId: other.id,
          userId: other.id,
          ipAddress: "198.51.100.83",
          createdAt: new Date(anchor + 1000),
        },
      });
      return { user, other, name, client: renamedClient };
    });
    const client = fixture.client;
    const actor = await isolatedWorker.createSession(fixture.user.id);
    await page.context().addCookies([actor.cookie]);
    await io.observeCalendar(fixture.user, [], { calendar: "absent" });
    const session = await db.session.findFirstOrThrow({
      where: { userId: fixture.user.id },
    });
    const auditsBefore = await db.auditLog.findMany({ orderBy: { id: "asc" } });
    expect(auditsBefore).toHaveLength(22);
    const authorizationStarted = Date.now();
    await gotoAndWaitForReady(page, "/account/settings/security");
    const region = page.getByRole("region", {
      name: /账户安全活动|Account security activity/i,
    });
    const assertPrivacy = async () => {
      const text = await region.innerText();
      expect(text).not.toContain("198.51.100");
      expect(text).not.toContain("Chrome/130.0");
      expect(text).not.toContain("never-show-this-account-content");
      expect(text).not.toContain("private-request-marker");
      expect(text).not.toContain(client.clientId);
      expect(text).toContain("Chrome · Windows");
      await expect(region.locator("img")).toHaveCount(0);
    };
    await expect(region.getByRole("listitem")).toHaveCount(20);
    for (let i = 0; i < 20; i++) {
      await expect(
        region.getByText(`203.0.${i}.*`, { exact: true }),
      ).toBeVisible();
      expect(await region.innerText()).not.toContain(`203.0.${i}.42`);
    }
    await expect(region.getByText(fixture.name, { exact: true })).toHaveCount(
      20,
    );
    await assertPrivacy();
    await region.getByRole("link", { name: /更早|Older/i }).click();
    await expect(page).toHaveURL(/cursor=/);
    await expect(region.getByRole("listitem")).toHaveCount(1);
    await expect(region.getByText("203.0.20.*", { exact: true })).toBeVisible();
    await assertPrivacy();
    await region
      .getByRole("link", { name: /返回最新活动|Back to latest/i })
      .click();
    await expect(page).toHaveURL(/\/account\/settings\/security$/);
    const token = await authorizeDeviceBearer(
      page.request,
      origin,
      client.clientId,
      "account.profile:read",
    );
    const headers = { cookie: "", authorization: `Bearer ${token}` };
    const authorizationFinished = Date.now();
    const profileStarted = Date.now();
    const profile = await page.request.get("/api/account/profile", { headers });
    await profile.body();
    expect(profile.status()).toBe(200);
    const profileFinished = Date.now();
    for (const authorization of ["", headers.authorization]) {
      const response = await page.request.get("/account/settings/security", {
        headers: { cookie: "", authorization },
        maxRedirects: 0,
      });
      await response.body();
      expect(response.status()).toBe(303);
      expect(response.headers().location).toContain("/account/sign-in");
      expect(await response.text()).not.toContain(marker);
    }
    return {
      async verifyTransport({ effects, sdkRequests }) {
        expect(sdkRequests).toEqual([]);
        expect(
          effects.requests
            .filter(({ value }) => value.method !== "GET")
            .map(({ value, result }) => [value.method, value.path, result]),
        ).toEqual([
          ["POST", "/api/auth/oauth2/device-authorization", 200],
          ["POST", "/oauth/device", 303],
          ["POST", "/api/auth/oauth2/token", 200],
        ]);
        expect(
          effects.requests
            .filter(
              ({ value }) =>
                value.method === "GET" && value.path === "/api/account/profile",
            )
            .map(({ result }) => result),
        ).toEqual([200]);
        expect(
          effects.requests.filter(
            ({ value, result }) =>
              value.path === "/account/settings/security" && result === 303,
          ),
        ).toHaveLength(2);
      },
      async verifyState() {
        expect(await db.user.findMany({ orderBy: { id: "asc" } })).toEqual(
          [fixture.user, fixture.other].sort((a, b) =>
            a.id.localeCompare(b.id),
          ),
        );
        expect(fixture.user.calendarFeedToken).toBeNull();
        expect(await db.auditLog.findMany({ orderBy: { id: "asc" } })).toEqual(
          auditsBefore,
        );
        expect(await db.oAuthClient.findMany()).toEqual([client]);
        const sessions = await db.session.findMany();
        expect(sessions).toEqual([
          {
            ...session,
            expires: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        ]);
        const expiryClock = sessions[0].expires.getTime() - 30 * 86400_000;
        for (const time of [expiryClock, sessions[0].updatedAt.getTime()]) {
          expect(time).toBeGreaterThanOrEqual(authorizationStarted);
          expect(time).toBeLessThanOrEqual(authorizationFinished);
        }
        expect(sessions[0].updatedAt.getTime()).toBeGreaterThanOrEqual(
          expiryClock,
        );
        expect(sessions[0].expires.getTime()).toBeGreaterThan(
          session.expires.getTime(),
        );
        const consents = await db.oAuthConsent.findMany({
          select: {
            userId: true,
            clientId: true,
            grantId: true,
            scopes: true,
            resources: true,
            requestedUserInfoClaims: true,
          },
        });
        expect(consents).toEqual([
          {
            userId: fixture.user.id,
            clientId: client.clientId,
            grantId: expect.any(String),
            scopes: ["account.profile:read"],
            resources: [`${origin}/api/auth`],
            requestedUserInfoClaims: [],
          },
        ]);
        const grantId = consents[0].grantId;
        expect(grantId).toMatch(/^[0-9a-f-]{36}$/);
        expectOAuthUsage(
          await db.oAuthGrantUsageDaily.findMany({ orderBy: { day: "asc" } }),
          {
            dimensions: {
              userId: fixture.user.id,
              clientId: client.clientId,
              grantId,
              feature: "account.profile",
              channel: "rest",
            },
            counts: [1, 0, 0],
            windows: [
              {
                start: profileStarted,
                end: profileFinished,
                operation: "read",
              },
            ],
          },
        );
        expect(await db.deviceCode.count()).toBe(0);
        expect(await db.oAuthAccessToken.count()).toBe(0);
        expect(await db.oAuthRefreshToken.count()).toBe(0);
        expect(await db.upload.count()).toBe(0);
        expect(await db.uploadPending.count()).toBe(0);
      },
    };
  });
});
