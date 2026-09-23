import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { ensureSeedSectionSubscription } from "../../../../utils/subscriptions";

test.describe("仪表盘作业", () => {
  test.describe.configure({ mode: "serial" });

  test("可切换作业完成状态", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    // Switch to "all" filter
    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    await expect(page.getByRole("switch")).toHaveCount(0);

    const row = page
      .getByRole("row")
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await expect(row).toBeVisible();

    const completionButton = row
      .getByRole("button", {
        name: /标记为完成|取消完成|Mark as complete|Mark as incomplete/i,
      })
      .first();
    await expect(completionButton).toBeVisible();

    const before =
      (await completionButton.getAttribute("aria-label"))?.trim() ?? "";

    const completionResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/workspace/homeworks/") &&
        r.url().includes("/completion") &&
        r.status() === 200,
    );
    await completionButton.click();
    await completionResponse;
    await expect(completionButton).not.toHaveAttribute("aria-label", before, {
      timeout: 15_000,
    });

    const after =
      (await completionButton.getAttribute("aria-label"))?.trim() ?? "";
    expect(after).not.toBe(before);
    await captureStepScreenshot(page, testInfo, "homeworks/completion-toggled");

    // Restore
    const restoreResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/workspace/homeworks/") &&
        r.url().includes("/completion") &&
        r.status() === 200,
    );
    await completionButton.click();
    await restoreResponse;
  });

  test("完成状态更新失败显示本地化仪表盘错误", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await page.route(
      /\/api\/workspace\/homeworks\/[^/]+\/completion$/,
      async (route) => {
        await route.fulfill({
          body: JSON.stringify({ error: { message: "forced failure" } }),
          contentType: "application/json",
          status: 500,
        });
      },
    );
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    const row = page
      .getByRole("row")
      .filter({ hasText: DEV_SEED.homeworks.title })
      .first();
    await expect(row).toBeVisible();

    const completionButton = row
      .getByRole("button", {
        name: /标记为完成|取消完成|Mark as complete|Mark as incomplete/i,
      })
      .first();
    await expect(completionButton).toBeVisible();

    const completionResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/api/workspace/homeworks/") &&
        r.url().includes("/completion") &&
        r.status() === 500,
    );
    await completionButton.click();
    await completionResponse;

    await expect(
      page.getByText(/更新完成状态失败|Couldn't update completion/i),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "homeworks/completion-error");
  });
});
