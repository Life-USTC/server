import { expect } from "@playwright/test";
import { test as privateTest } from "../../../../utils/account-fixture";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test } from "../../../../utils/public-worker";

test.describe("仪表盘无效标签（comments）", () => {
  test("/workspace/comments 不是仪表盘路由页面", {
    tag: "@Comment/Web",
  }, async ({ publicFlow, page }) => {
    await publicFlow.run(async () => {
      const response = await gotoAndWaitForReady(page, "/workspace/comments");

      expect(response?.status()).toBe(404);
      await expect(page.getByText(/not found|找不到/i)).toBeVisible();
    });
  });

  test("未登录 ?tab=comments 保持轻量公共首页", {
    tag: "@Comment/Web",
  }, async ({ publicFlow, page }) => {
    await publicFlow.run(async () => {
      await gotoAndWaitForReady(page, "/?tab=comments");

      // URL retains the invalid tab param
      await expect(page).toHaveURL(/\/\?tab=comments$/);
      await expect(page.locator("#app-logo")).toBeVisible();

      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /总览|Overview/i,
        }),
      ).toBeVisible();
      await expect(page.getByTestId("bus-compact-summary")).toHaveCount(0);
    });
  });

  privateTest(
    "登录后 ?tab=comments 回退到总览",
    { tag: "@Comment/Web" },
    async ({ run, accountRun, page, isolatedWorker }) => {
      const actor = await run(async () => {
        const actor = await isolatedWorker.createActor();
        await page.context().addCookies([actor.cookie]);
        return actor;
      });
      await accountRun({ writes: [], audits: [] }, async () => {
        const session = await page.request.get("/api/auth/get-session");
        expect(session.status()).toBe(200);
        expect((await session.json()).user.id).toBe(actor.id);
        const redirect = await page.request.get("/?tab=comments", {
          maxRedirects: 0,
        });
        expect(redirect.status()).toBe(200);
        expect(redirect.headers().location).toBeUndefined();
        await gotoAndWaitForReady(page, "/?tab=comments");
        await expect(page).toHaveURL(/\/\?tab=comments$/);

        await expect(page.locator("#main-content")).toBeVisible();
        await expect(page.locator("#app-user-menu")).toBeVisible();

        await expect(
          page
            .getByTestId("app-sidebar")
            .getByRole("link", { name: "Life@USTC", exact: true }),
        ).toHaveAttribute("aria-current", "page");
        await expect(page.getByTestId("home-personal-overview")).toBeVisible();
      });
    },
  );
});
