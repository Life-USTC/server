/**
 * E2E tests for /privacy page
 *
 * Static legal page rendering the privacy policy from i18n keys.
 */

import { expect } from "@playwright/test";
import { test as privateTest } from "../../../utils/account-fixture";
import { observeAction } from "../../../utils/observed-action";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { test as noScriptTest } from "../../../utils/personal-preferences-fixture";
import { test } from "../../../utils/public-worker";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/privacy 隐私政策页", () => {
  test("页面契约", async ({ publicFlow, page }) => {
    await publicFlow.run(async () => {
      await assertPageContract(page, { routePath: "/privacy" });
    });
  });

  test("渲染带章节的隐私政策", async ({ publicFlow, page }) => {
    await publicFlow.run(async () => {
      await gotoAndWaitForReady(page, "/privacy");
      await waitForUiSettled(page);

      await expect(page.locator("#main-content")).toBeVisible();
      await expect(page.locator("h1")).toBeVisible();

      const sections = page.locator("h2");
      await expect(sections.first()).toBeVisible();
      expect(await sections.count()).toBeGreaterThan(0);

      const listItems = page.locator("li");
      expect(await listItems.count()).toBeGreaterThan(0);
    });
  });

  test("320px 列表内容完整换行", async ({ publicFlow, page }) => {
    await publicFlow.run(async () => {
      await page.setViewportSize({ width: 320, height: 800 });
      await gotoAndWaitForReady(page, "/privacy");

      const overflow = await page
        .locator('[data-slot="legal-document"] .markdown-preview')
        .evaluate((markdown) => {
          const elements = [
            markdown,
            ...Array.from(markdown.querySelectorAll<HTMLElement>("ul, ol, li")),
          ];
          return elements
            .map((element) => ({
              clientWidth: element.clientWidth,
              scrollWidth: element.scrollWidth,
              tag: element.tagName,
            }))
            .filter(
              ({ clientWidth, scrollWidth }) => scrollWidth > clientWidth + 1,
            );
        });

      expect(overflow).toEqual([]);
      await expect(
        page.locator('[data-slot="legal-document"] li').first(),
      ).toBeVisible();
    });
  });

  privateTest(
    "登录用户共享匿名 SSR 并通过私有请求恢复身份",
    async ({ run, accountRun, page, isolatedWorker }) => {
      const actor = await run(async () => {
        const actor = await isolatedWorker.createActor();
        await page.context().addCookies([actor.cookie]);
        return actor;
      });
      await accountRun({ writes: [], audits: [] }, async () => {
        await gotoAndWaitForReady(page, "/privacy");

        const documentResponse = await page.request.get("/privacy");
        expect(documentResponse.status()).toBe(200);
        expect(documentResponse.headers()["cache-control"]).toMatch(/no-store/);
        const html = await documentResponse.text();
        expect(html).toContain('data-testid="viewer-loading"');
        expect(html).not.toContain('id="app-user-menu"');
        const session = await page.request.get("/api/auth/get-session");
        expect(session.status()).toBe(200);
        const { user } = await session.json();
        expect(user.id).toBeTruthy();
        expect(user.id).toBe(actor.id);
        expect(html).not.toContain(user.id);

        const bootstrap = await observeAction(
          () =>
            page.waitForResponse((response) =>
              response.url().endsWith("/_internal/shell-bootstrap"),
            ),
          () => gotoAndWaitForReady(page, "/privacy"),
        );
        expect(bootstrap.status()).toBe(200);
        expect(bootstrap.headers()["cache-control"]).toBe("private, no-store");
        expect((await bootstrap.json()).viewer.id).toBe(user.id);
        await expect(page.getByTestId("viewer-loading")).toHaveCount(0);
        await expect(page.locator("#app-user-menu")).toBeVisible();
        await expect(
          page.getByRole("link", { name: /^(登录|Sign in)$/i }),
        ).toHaveCount(0);
      });
    },
  );
});

test.describe("/privacy 无 JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  noScriptTest("SSR 保留完整政策正文", async ({ preferenceFlow }) => {
    await preferenceFlow.run(async () => {
      const context = await preferenceFlow.newContext({
        javaScriptEnabled: false,
      });
      const page = await preferenceFlow.newPage(context);
      await page.goto("/privacy");

      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("h2").first()).toBeVisible();
      await expect(page.locator("li").first()).toBeVisible();
    });
  });
});
