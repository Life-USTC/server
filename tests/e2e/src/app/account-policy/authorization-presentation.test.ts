import { expect, type Page, test } from "@playwright/test";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  createOAuthAuthorizationFixture,
  deleteOAuthClientsByName,
  ensureLinkedAccountFixture,
} from "../../../utils/e2e-db";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

async function fixture(page: Page) {
  const marker = crypto.randomUUID();
  const user = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        name: "Application owner",
        username: `ap${marker.replaceAll("-", "").slice(0, 12)}`,
        email: `${marker}@example.test`,
      },
    }),
  );
  const cookie = await createSignedSessionCookie(user.id);
  await page
    .context()
    .addCookies([
      cookie,
      { name: "NEXT_LOCALE", value: "en-us", url: cookie.url },
    ]);
  const name = `<img src=x onerror=alert(1)> App ${marker}`;
  const grant = await createOAuthAuthorizationFixture({
    name,
    userId: user.id,
    scopes: ["calendar:read", "profile"],
  });
  return {
    user,
    cookie,
    grant,
    async cleanup() {
      await deleteOAuthClientsByName(name);
      await withE2ePrisma(async (db) => {
        await db.auditLog.deleteMany({ where: { userId: user.id } });
        await db.user.delete({ where: { id: user.id } });
      });
    },
  };
}

test("user.sign-in-identities-separate", async ({ page }) => {
  const f = await fixture(page);
  try {
    await ensureLinkedAccountFixture({
      userId: f.user.id,
      provider: "github",
      providerAccountId: `identity-${crypto.randomUUID()}`,
    });
    await gotoAndWaitForReady(page, "/account/settings/accounts");
    const identities = page.getByRole("region", {
      name: "Linked Accounts",
      exact: true,
    });
    const github = identities
      .getByRole("listitem")
      .filter({ hasText: "GitHub" });
    await expect(github.getByText("Connected", { exact: true })).toBeVisible();
    await expect(
      github.getByRole("button", { name: "Disconnect", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(f.grant.name, { exact: true })).toHaveCount(0);
    await page
      .getByRole("link", { name: "Authorized apps", exact: true })
      .click();
    await expect(page).toHaveURL(/\/account\/settings\/authorizations$/);
    const apps = page.getByRole("region", {
      name: "Authorized OAuth applications",
      exact: true,
    });
    await expect(apps.getByText(f.grant.name, { exact: true })).toBeVisible();
    await expect(
      apps.getByRole("button", { name: "Revoke", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Linked Accounts", exact: true }),
    ).toHaveCount(0);
    await expect(
      apps.getByRole("button", { name: "Disconnect", exact: true }),
    ).toHaveCount(0);
    expect(
      await withE2ePrisma((db) =>
        db.account.count({ where: { userId: f.user.id } }),
      ),
    ).toBe(1);
    expect(
      await withE2ePrisma((db) =>
        db.oAuthConsent.count({ where: { userId: f.user.id } }),
      ),
    ).toBe(1);
  } finally {
    await f.cleanup();
  }
});

test("user.oauth-authorization-management", async ({ page }) => {
  const f = await fixture(page);
  const grantId = crypto.randomUUID();
  const now = new Date();
  try {
    await withE2ePrisma(async (db) => {
      await db.oAuthConsent.update({
        where: { id: f.grant.consentId },
        data: { grantId },
      });
      await db.oAuthClient.update({
        where: { clientId: f.grant.clientId },
        data: { metadata: { privateMarker: "private-request-content" } },
      });
      for (const [
        offset,
        generation,
        readCount,
        writeCount,
        errorCount,
        channel,
        feature,
      ] of [
        [0, grantId, 7, 3, 2, "mcp", "workspace.calendar"],
        [-29, grantId, 10, 4, 1, "rest", "account.profile"],
        [-30, grantId, 900, 900, 900, "graphql", "todo"],
        [0, "previous-generation", 800, 800, 800, "graphql", "todo"],
      ] as const)
        await db.oAuthGrantUsageDaily.create({
          data: {
            userId: f.user.id,
            clientId: f.grant.clientId,
            grantId: generation,
            grantKey: `grant:${generation}`,
            day: new Date(
              `${shanghaiDayjs(now).add(offset, "day").format("YYYY-MM-DD")}T00:00:00.000Z`,
            ),
            feature,
            channel,
            readCount,
            writeCount,
            errorCount,
            lastUsedAt: new Date(now.getTime() + offset * 86400_000),
          },
        });
    });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await gotoAndWaitForReady(page, "/account/settings/authorizations");
      const item = page
        .getByRole("region", {
          name: "Authorized OAuth applications",
          exact: true,
        })
        .getByRole("listitem");
      await expect(item).toHaveCount(1);
      await expect(item.getByText(f.grant.name, { exact: true })).toBeVisible();
      await expect(
        item.getByText(f.grant.clientUri, { exact: true }),
      ).toBeVisible();
      await expect(item.locator("img")).toHaveCount(0);
      for (const [label, value] of [
        ["reads", "17"],
        ["writes", "7"],
        ["errors", "3"],
        ["Last channel", "MCP"],
        ["Last feature", "Calendar"],
      ]) {
        const definition = item.locator("dl > div").filter({
          has: page.locator("dt").filter({ hasText: new RegExp(`^${label}$`) }),
        });
        await expect(definition.locator("dd")).toHaveText(value);
      }
      await expect(
        item.getByText("Last 30 days", { exact: true }),
      ).toBeVisible();
      const text = await page.locator("#main-content").innerText();
      for (const privateValue of [
        f.grant.clientId,
        f.grant.clientSecret,
        f.grant.redirectUri,
        f.cookie.value,
        grantId,
        "private-request-content",
        "previous-generation",
      ])
        expect(text).not.toContain(privateValue);
    }
  } finally {
    await f.cleanup();
  }
});
