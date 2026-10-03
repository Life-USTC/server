import { expect } from "@playwright/test";
import {
  supplement as content,
  discussion,
  test,
} from "../../../utils/community-fixture";
import { waitForUiSettled } from "../../../utils/page-ready";

test.describe.configure({ mode: "parallel" });

test("description.public-web-personal-overlay", async ({
  communityFlow,
  page,
  presentation: { targets },
}) => {
  await communityFlow.run(async () => {
    const anonymous = await communityFlow.newContext({
      javaScriptEnabled: false,
    });
    try {
      const staticPage = await anonymous.newPage();
      for (const target of targets) {
        const response = await staticPage.goto(target.path);
        expect(response?.status()).toBe(200);
        await expect(staticPage.locator("#introduction")).toContainText(
          content,
        );
        const jsonLd = await staticPage
          .locator('script[type="application/ld+json"]')
          .allTextContents();
        expect(jsonLd.length).toBeGreaterThan(0);
        for (const raw of jsonLd) expect(JSON.parse(raw)).toBeTruthy();
        const payload = await anonymous.request.get(
          `/api/community/descriptions?targetType=${target.type}&targetId=${target.id}`,
          { maxRetries: 1 },
        );
        expect(payload.status()).toBe(200);
        expect((await payload.json()).viewer).toMatchObject({
          isAuthenticated: false,
          isAdmin: false,
        });
      }
    } finally {
      await communityFlow.closeContext(anonymous);
    }
    const failed = new Set<string>();
    const resolved = new Set<string>();
    await communityFlow.route(
      page,
      "**/api/community/descriptions?**",
      async (route) => {
        const url = new URL(route.request().url());
        const key = `${url.searchParams.get("targetType")}:${url.searchParams.get("targetId")}`;
        if (!failed.has(key)) {
          failed.add(key);
          await route.fulfill({
            status: 503,
            json: { error: "Controlled permission-read failure" },
          });
          return;
        }
        const response = await route.fetch();
        const payload = await response.json();
        expect(payload.viewer.isAuthenticated).toBe(true);
        resolved.add(key);
        await route.fulfill({ response, json: payload });
      },
    );
    for (const target of targets) {
      await page.goto(`${target.path}#introduction`);
      const introduction = page.locator("#introduction");
      const retry = introduction.getByRole("button", { name: /重试|Retry/i });
      await expect(retry).toBeVisible();
      await expect(introduction.getByTestId("description-edit")).toHaveCount(0);
      await expect(introduction).toContainText(content);
      await retry.click();
      await expect(introduction.getByTestId("description-edit")).toBeVisible();
      expect(resolved.has(`${target.type}:${target.id}`)).toBe(true);
    }
  }, {});
});

test("description.supplement-not-comment", async ({
  communityFlow,
  page,
  account,
  presentation: { targets },
}) => {
  await communityFlow.run(async () => {
    await page.context().clearCookies();
    for (const target of targets) {
      await page.goto(target.path);
      await waitForUiSettled(page);
      const introduction = page.locator("#introduction");
      const comments = page.locator("#comments");
      await expect(introduction).toContainText(content);
      await expect(introduction).toContainText(account.name);
      await expect(introduction).toContainText("2026");
      await expect(introduction).not.toContainText(discussion);
      await expect(comments).toContainText(discussion);
      await expect(comments).not.toContainText(content);
    }
  }, {});
});

test("description.platform-maintained", async ({
  communityFlow,
  page,
  account,
  presentation: { targets },
}) => {
  await communityFlow.run(async () => {
    await page.goto(`${targets[2].path}#introduction`);
    const introduction = page.locator("#introduction");
    await expect(introduction.getByTestId("description-edit")).toBeVisible();
    await expect(introduction).toContainText(account.name);
    await expect(introduction).not.toContainText(
      /大学认证|官方认证|University.verified|University.approved/i,
    );
    await introduction.getByRole("tab", { name: /历史|History/i }).click();
    await expect(introduction).toContainText("Before supplement");
    await expect(introduction).toContainText(content);
    await expect(introduction).toContainText(account.name);
  }, {});
});

test("description.web-markdown-hydration", async ({
  communityFlow,
  page,
  presentation: { targets },
}) => {
  await communityFlow.run(async () => {
    await communityFlow.route(
      page,
      "**/api/community/descriptions?**",
      async (route) => {
        const response = await route.fetch();
        const payload = await response.json();
        payload.description.renderedHtml =
          '<strong data-testid="server-description-html">Server-rendered supplement</strong>';
        payload.description.content =
          "CLIENT_RENDERER_MUST_NOT_REPLACE_SERVER_HTML";
        await route.fulfill({ response, json: payload });
      },
    );
    await page.goto(`${targets[2].path}#introduction`);
    await expect(page.getByTestId("server-description-html")).toHaveText(
      "Server-rendered supplement",
    );
    await expect(page.locator("#introduction")).not.toContainText(
      "CLIENT_RENDERER_MUST_NOT_REPLACE_SERVER_HTML",
    );
    await page.getByRole("tab", { name: /历史|History/i }).click();
    await page.locator("#introduction").getByRole("tab").first().click();
    await expect(page.getByTestId("server-description-html")).toBeVisible();
  }, {});
});

test("comment.web-markdown-hydration", async ({
  communityFlow,
  page,
  presentation: { targets },
}) => {
  await communityFlow.run(async () => {
    await page.context().clearCookies();
    await communityFlow.route(
      page,
      "**/api/community/comments?**",
      async (route) => {
        const response = await route.fetch();
        const payload = await response.json();
        expect(payload.data.length).toBeGreaterThan(0);
        payload.data[0].renderedBody =
          '<strong data-testid="server-comment-html">Server-rendered discussion</strong>';
        payload.data[0].body = "CLIENT_RENDERER_MUST_NOT_REPLACE_COMMENT_HTML";
        await route.fulfill({ response, json: payload });
      },
    );
    await page.goto(`${targets[2].path}#comments`);
    await waitForUiSettled(page);
    await expect(page.getByTestId("server-comment-html")).toHaveText(
      "Server-rendered discussion",
    );
    await expect(page.locator("#comments")).not.toContainText(
      "CLIENT_RENDERER_MUST_NOT_REPLACE_COMMENT_HTML",
    );
  }, {});
});
