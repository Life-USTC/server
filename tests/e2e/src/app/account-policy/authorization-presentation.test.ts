import { createOAuthAccountIssuer } from "@better-auth/core/db";
import { expect } from "@playwright/test";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { test as workerTest } from "../../../utils/owned-worker";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

async function prepareAuthorization(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const marker = crypto.randomUUID();
  const name = `<img src=x onerror=alert(1)> App ${marker}`;
  const clientId = crypto.randomUUID();
  const clientSecret = `hidden-secret-${crypto.randomUUID()}`;
  const redirectUri = new URL("/hidden-oauth-callback", worker.origin).href;
  const clientUri = "https://calendar.example";
  const scopes = ["workspace.calendar:read", "profile"];
  const { user, consent } = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: "Application owner",
        username: `ap${marker.replaceAll("-", "").slice(0, 12)}`,
        email: `${marker}@example.test`,
      },
    });
    await tx.oAuthClient.create({
      data: {
        clientId,
        clientSecret,
        name,
        redirectUris: [redirectUri],
        scopes,
        uri: clientUri,
      },
    });
    const consent = await tx.oAuthConsent.create({
      data: { clientId, scopes, userId: user.id },
      select: { id: true },
    });
    return { user, consent };
  });
  const { cookie } = await worker.createSession(user.id);
  return {
    db,
    user,
    cookie,
    grant: {
      clientId,
      clientSecret,
      clientUri,
      consentId: consent.id,
      name,
      redirectUri,
      scopes,
    },
  };
}

const test = workerTest.extend<{
  owned: Awaited<ReturnType<typeof prepareAuthorization>>;
  authorizationRun: (work: () => Promise<void>) => Promise<void>;
}>({
  owned: async ({ isolatedWorker, run }, use) => {
    await use(await run(() => prepareAuthorization(isolatedWorker)));
  },
  authorizationRun: async ({ page, owned, run }, use) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work) =>
        workflow.run(() =>
          run(() =>
            workflow.body(async () => {
              await page.context().addCookies([
                owned.cookie,
                {
                  name: "NEXT_LOCALE",
                  value: "en-us",
                  url: owned.cookie.url,
                },
              ]);
              await work();
            }),
          ),
        ),
      );
    });
  },
});

test("user.sign-in-identities-separate", async ({
  page,
  owned: f,
  authorizationRun,
}) => {
  await authorizationRun(async () => {
    await f.db.$transaction(async (tx) => {
      await tx.account.create({
        data: {
          userId: f.user.id,
          type: "oauth",
          provider: "github",
          issuer: createOAuthAccountIssuer("github"),
          providerAccountId: `identity-${crypto.randomUUID()}`,
        },
      });
      await tx.verifiedEmail.create({
        data: {
          userId: f.user.id,
          provider: "github",
          email: `github-${crypto.randomUUID()}@example.test`,
        },
      });
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
    expect(await f.db.account.count({ where: { userId: f.user.id } })).toBe(1);
    expect(
      await f.db.oAuthConsent.count({ where: { userId: f.user.id } }),
    ).toBe(1);
  });
});

test("user.oauth-authorization-management", async ({
  page,
  owned: f,
  authorizationRun,
}) => {
  await authorizationRun(async () => {
    const grantId = crypto.randomUUID();
    const now = new Date();
    const otherClientName = "Other owner's application";
    await f.db.$transaction(async (db) => {
      await db.oAuthConsent.update({
        where: { id: f.grant.consentId },
        data: { grantId },
      });
      await db.oAuthClient.update({
        where: { clientId: f.grant.clientId },
        data: { metadata: { privateMarker: "private-request-content" } },
      });
      const otherUser = await db.user.create({
        data: {
          name: "Other application owner",
          email: `other-authorization-${crypto.randomUUID()}@example.test`,
        },
      });
      const otherClient = await db.oAuthClient.create({
        data: {
          clientId: crypto.randomUUID(),
          name: otherClientName,
          redirectUris: ["https://other.example/callback"],
          scopes: ["profile"],
        },
      });
      await db.oAuthConsent.create({
        data: {
          clientId: otherClient.clientId,
          userId: otherUser.id,
          scopes: ["profile"],
        },
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
      await expect(
        item.getByText("Read your calendar", { exact: true }),
      ).toBeVisible();
      await expect(
        item.getByText("View your profile information", { exact: true }),
      ).toBeVisible();
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
      expect(text).not.toContain(otherClientName);
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
  });
});
