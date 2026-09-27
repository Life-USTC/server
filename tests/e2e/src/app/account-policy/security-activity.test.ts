import { expect, test } from "@playwright/test";
import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import {
  createOAuthClientFixture,
  deleteOAuthClientsByName,
} from "../../../utils/e2e-db";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { authorizeDeviceBearer } from "../../../utils/oauth-device-bearer";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

test("user.account-security-activity", async ({ page }) => {
  const marker = `security-view-${crypto.randomUUID()}`;
  const client = await createOAuthClientFixture({
    name: marker,
    scopes: ["account.profile:read"],
    grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
    tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  });
  const fixture = await withE2ePrisma(async (db) => {
    const user = await db.user.create({
      data: {
        name: marker,
        username: `sv${crypto.randomUUID().slice(0, 8)}`,
        email: `${marker}@example.test`,
      },
    });
    const other = await db.user.create({
      data: { name: "Other account", email: `other-${marker}@example.test` },
    });
    const name = `<img src=x onerror=alert(1)> ${marker}`;
    await db.oAuthClient.update({
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
    return { user, other, name };
  });
  try {
    await page
      .context()
      .addCookies([await createSignedSessionCookie(fixture.user.id)]);
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
    await region.getByRole("link", { name: /返回最新活动|Back to latest/i }).click();
    await expect(page).toHaveURL(/\/account\/settings\/security$/);
    const token = await authorizeDeviceBearer(
      page.request,
      client.clientId,
      "account.profile:read",
    );
    const headers = { cookie: "", authorization: `Bearer ${token}` };
    expect(
      (await page.request.get("/api/account/profile", { headers })).status(),
    ).toBe(200);
    for (const authorization of ["", headers.authorization]) {
      const response = await page.request.get("/account/settings/security", {
        headers: { cookie: "", authorization },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(303);
      expect(response.headers().location).toContain("/account/sign-in");
      expect(await response.text()).not.toContain(marker);
    }
  } finally {
    await withE2ePrisma(async (db) => {
      await db.auditLog.deleteMany({
        where: {
          OR: [
            { subjectUserId: { in: [fixture.user.id, fixture.other.id] } },
            { oauthClientId: client.clientId },
          ],
        },
      });
      await db.user.deleteMany({
        where: { id: { in: [fixture.user.id, fixture.other.id] } },
      });
    });
    await deleteOAuthClientsByName(fixture.name);
  }
});
