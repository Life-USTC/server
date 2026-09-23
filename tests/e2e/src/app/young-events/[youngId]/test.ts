/**
 * E2E tests for /catalog/young-events/[youngId] — 第二课堂活动详情
 *
 * ## Data Represented
 * - One signup event: name, category, status, event time, signup window,
 *   location, organizer, department, hours, capacity
 * - Seed event: DEV_SEED.youngEvent (youngId dev-scenario-young-event)
 *
 * ## UI/UX Elements
 * - Field grid with event metadata
 * - External signup link to young.ustc.edu.cn
 * - Back link to the event list
 *
 * ## Edge Cases
 * - Unknown youngId renders the 404 error page
 */
import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { visibleText } from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { assertPageContract } from "../../_shared/page-contract";

const DETAIL_PATH = `/catalog/young-events/${DEV_SEED.youngEvent.youngId}`;

test.describe("/catalog/young-events/[youngId] 第二课堂活动详情", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/catalog/young-events/[youngId]",
      testInfo,
    });
  });

  test("渲染活动字段与返回链接", async ({ page }) => {
    await gotoAndWaitForReady(page, DETAIL_PATH);

    await expect(
      page.getByRole("heading", { level: 1, name: DEV_SEED.youngEvent.name }),
    ).toBeVisible();
    await expect(visibleText(page, DEV_SEED.youngEvent.location)).toBeVisible();
    await expect(
      visibleText(page, DEV_SEED.youngEvent.organizer),
    ).toBeVisible();

    const signupLink = page.getByRole("link", {
      name: /young\.ustc\.edu\.cn/i,
    });
    await expect(signupLink).toBeVisible();
    await expect(signupLink).toHaveAttribute(
      "href",
      "https://young.ustc.edu.cn",
    );

    const backLink = page.getByRole("link", {
      name: /返回活动列表|Back to all events/i,
    });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await page.waitForURL(/\/catalog\/young-events$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /第二课堂|Second Classroom/i,
      }),
    ).toBeVisible();
  });

  test("未知 youngId 显示 404", async ({ page }) => {
    const response = await page.goto(
      "/catalog/young-events/e2e-unknown-young-id",
    );
    expect(response?.status()).toBe(404);
  });
});
