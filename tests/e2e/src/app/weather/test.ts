/**
 * E2E tests for /catalog/weather page
 *
 * Public weather page rendering the two tracked USTC campus locations.
 * Provider availability is environment-dependent, so content assertions
 * accept either live snapshots or the unavailable state.
 */
import { expect, test } from "@playwright/test";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/catalog/weather", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/catalog/weather",
      testInfo,
    });
  });

  test("渲染两个校区位置面板", async ({ page }, testInfo) => {
    // 本部与高新校区两个位置面板
    await gotoAndWaitForReady(page, "/catalog/weather", {
      testInfo,
      screenshotLabel: "weather",
    });
    await waitForUiSettled(page);

    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();

    const headings = page.locator("h2");
    await expect(headings).toHaveCount(2);
    await expect(headings.filter({ hasText: /本部|Main campus/ })).toHaveCount(
      1,
    );
    await expect(
      headings.filter({ hasText: /高新校区|Gaoxin campus/ }),
    ).toHaveCount(1);

    const panels = page.locator(
      '[data-testid="weather-location"], [data-testid="weather-unavailable"]',
    );
    await expect(panels.first()).toBeVisible();
    expect(await panels.count()).toBe(2);
  });
});
