/**
 * E2E tests for the bus dashboard tab (/dashboard/bus)
 *
 * ## Behavior
 * - /bus is the canonical public planner; /dashboard/bus keeps saved preferences
 * - Public users get a client-side planner: weekday/weekend, start stop, end stop,
 *   reverse, and departed-trip toggle
 * - Applicable routes are ordered by the next bus available from the selected start stop
 * - Signed-in users have planner defaults auto-saved through /api/workspace/bus-preferences
 */
import { expect, type Page, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../utils/auth";
import {
  getCurrentSessionUser,
  setBusPreferenceFixture,
} from "../../../utils/e2e-db";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../utils/page-ready";
import { absoluteTestUrl } from "../../../utils/request-url";
import { captureStepScreenshot } from "../../../utils/screenshot";

async function setLocale(
  page: Page,
  baseURL: string | undefined,
  locale: "en-us" | "zh-cn",
) {
  await page.context().addCookies([
    {
      name: "NEXT_LOCALE",
      value: locale,
      url: absoluteTestUrl("/", baseURL),
      sameSite: "Lax",
    },
  ]);
}

async function chooseStop(page: Page, label: RegExp, option: RegExp) {
  const group =
    label.source.includes("Start") || label.source.includes("出发")
      ? page.locator("[data-testid='bus-start-stop-group']")
      : page.locator("[data-testid='bus-end-stop-group']");
  const button = group.getByRole("radio", { name: option });
  await expect(async () => {
    if ((await button.getAttribute("aria-checked")) !== "true") {
      await button.click();
    }
    await expect(button).toHaveAttribute("aria-checked", "true");
  }).toPass({
    timeout: 10_000,
    intervals: [250, 500, 1_000],
  });
}

function routeSectionRows(page: Page) {
  return page.locator("section:visible").filter({
    has: page.locator("table"),
  });
}

async function openRouteControls(page: Page) {
  const trigger = page.getByRole("button", {
    name: /Change route|调整路线/,
  });
  if (await trigger.isVisible()) await trigger.click();
  await expect(
    page.locator("[data-testid='bus-start-stop-group']"),
  ).toBeVisible();
}

async function openFullTimetable(page: Page) {
  const trigger = page.getByRole("button", {
    name: /Full timetable|完整时刻表/,
  });
  if (await trigger.isVisible()) await trigger.click();
  await expect(page.locator("table").first()).toBeVisible();
}

async function expectMinimumTargetHeight(page: Page, selectors: RegExp[]) {
  for (const selector of selectors) {
    const target = page.getByRole("button", { name: selector }).last();
    await expect(target).toBeVisible();
    expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
      44,
    );
  }
}

async function expectDiscoverableTimetableScroll(page: Page) {
  const regions = page.getByTestId("bus-timetable-scroll-region");
  const overflowIndex = await regions.evaluateAll((nodes) =>
    nodes.findIndex((node) => {
      const scroller = node.querySelector<HTMLElement>(
        '[data-slot="table-container"]',
      );
      return Boolean(
        scroller && scroller.scrollWidth > scroller.clientWidth + 1,
      );
    }),
  );
  expect(overflowIndex).toBeGreaterThanOrEqual(0);

  const region = regions.nth(overflowIndex);
  const scroller = region.locator('[data-slot="table-container"]');
  await expect(
    region.getByTestId("bus-timetable-scroll-cue-right"),
  ).toBeVisible();
  await expect(region.getByTestId("bus-timetable-scroll-cue-left")).toHaveCount(
    0,
  );

  await scroller.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect(
    region.getByTestId("bus-timetable-scroll-cue-left"),
  ).toBeVisible();
  await expect(
    region.getByTestId("bus-timetable-scroll-cue-right"),
  ).toHaveCount(0);
}

test.describe("校车面板标签页", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-07-17T03:00:00.000Z"));
  });

  test("/catalog/bus 是可索引的公共语义路径", async ({ page }, testInfo) => {
    const response = await gotoAndWaitForReady(page, "/catalog/bus", {
      testInfo,
      screenshotLabel: "bus-public-route",
    });

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/bus$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /校车|Shuttle Bus/i }),
    ).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/bus$/,
    );
  });

  test("旧版查询标签永久重定向并保留其他状态", async ({ page }) => {
    const response = await page.request.get("/?tab=bus&linkView=list", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe("/catalog/bus?linkView=list");
  });

  test("公共校车页面同时显示下一班与完整时刻表并按需展开规划器", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, "/catalog/bus", {
      testInfo,
      screenshotLabel: "bus",
    });

    const summary = page.getByTestId("bus-compact-summary");
    await expect(summary).toBeVisible();
    await expect(summary.getByText(/Next departure|下一班发车/)).toBeVisible();
    await expect(
      page.locator("[data-testid='bus-start-stop-group']"),
    ).toBeHidden();
    await expect(page.locator("table:visible").first()).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /Hide full timetable|收起完整时刻表/,
      }),
    ).toBeVisible();

    await openRouteControls(page);
    await expect(
      page.getByRole("radio", { name: /Weekday|工作日/ }).first(),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid='bus-start-stop-group']"),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid='bus-end-stop-group']"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Reverse|反向/ }).last(),
    ).toBeVisible();
    await expect(
      page.getByRole("switch", {
        name: /Show departed trips|显示已发车班次/,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Transit map|线路图/ }),
    ).toHaveAttribute("href", "/catalog/bus/map");
    await openFullTimetable(page);

    await captureStepScreenshot(page, testInfo, "bus-planner-public");
  });

  test("公共与登录校车界面不显示无值版本标签", async ({
    page,
    baseURL,
  }, testInfo) => {
    await setLocale(page, baseURL, "zh-cn");
    await gotoAndWaitForReady(page, "/catalog/bus");
    await expect(page.getByText("当前版本", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText("Static Structured Bus Timetable", { exact: true }),
    ).toHaveCount(0);
    await captureStepScreenshot(page, testInfo, "bus-version-label-zh-public");

    await signInAsDebugUser(page, "/catalog/bus");
    await setLocale(page, baseURL, "zh-cn");
    await gotoAndWaitForReady(page, "/catalog/bus");
    await expect(page.getByText("当前版本", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText("Static Structured Bus Timetable", { exact: true }),
    ).toHaveCount(0);

    await setLocale(page, baseURL, "en-us");
    await gotoAndWaitForReady(page, "/catalog/bus");
    await expect(page.getByText("Active version", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByText("Static Structured Bus Timetable", { exact: true }),
    ).toHaveCount(0);
  });

  test("登录校车面板 SSR 渲染服务端时刻表数据", async ({ page }) => {
    await signInAsDebugUser(page, "/catalog/bus");

    const response = await page.request.get("/catalog/bus");
    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(html).toContain('href="/catalog/bus/map"');
    expect(html).not.toMatch(
      /data-slot="alert"[\s\S]{0,240}当前暂无可用的校车数据。/,
    );
    expect(html).not.toMatch(
      /data-slot="alert"[\s\S]{0,240}No shuttle data is available right now\./,
    );
  });

  test("匿名校车面板 SSR 渲染公共时刻表数据", async ({ page }) => {
    const response = await page.request.get("/catalog/bus");
    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(html).toContain('href="/catalog/bus/map"');
    expect(html).not.toMatch(
      /data-slot="alert"[\s\S]{0,240}当前暂无可用的校车数据。/,
    );
    expect(html).not.toMatch(
      /data-slot="alert"[\s\S]{0,240}No shuttle data is available right now\./,
    );
  });

  test("公共校车页面在移动端保持下一班、路线更改和全表可用", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, "/catalog/bus", {
      testInfo,
      screenshotLabel: "bus-mobile",
    });

    const summary = page.getByTestId("bus-compact-summary");
    await expect(summary).toBeVisible();
    await expect(summary.locator("[data-slot='card-title']")).toHaveCSS(
      "font-size",
      "36px",
    );
    await expect(page.locator("table:visible").first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);

    await openRouteControls(page);
    await chooseStop(page, /End stop|到达站/, /南区/);
    await expect(summary).toContainText(/东区\s*→\s*南区/);

    await page.reload();
    await expect(
      page
        .locator("[data-testid='bus-end-stop-group']")
        .getByRole("radio", { name: /南区/ }),
    ).toBeHidden();
    await expect(summary).toContainText(/东区\s*→\s*南区/);
    await openFullTimetable(page);

    await captureStepScreenshot(page, testInfo, "bus-planner-public-mobile");
  });

  test("默认站点对按下一班可用校车排序显示所有适用线路", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, "/catalog/bus", {
      testInfo,
      screenshotLabel: "bus",
    });

    await openFullTimetable(page);
    await expect(routeSectionRows(page)).toHaveCount(2);
    const routeTexts = await routeSectionRows(page).allTextContents();
    expect(
      routeTexts.some((text) => /东区\s*→\s*北区\s*→\s*西区/.test(text)),
    ).toBe(true);
    expect(
      routeTexts.some((text) =>
        /东区\s*→\s*西区\s*→\s*先研院\s*→\s*高新/.test(text),
      ),
    ).toBe(true);
  });

  test("反向交换方向并重新计算适用线路", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/catalog/bus", {
      testInfo,
      screenshotLabel: "bus",
    });

    await openRouteControls(page);
    await openFullTimetable(page);
    const reverseButton = page
      .getByRole("button", { name: /Reverse|反向/ })
      .last();
    const startWestButton = page
      .locator("[data-testid='bus-start-stop-group']")
      .getByRole("radio", { name: /西区/ });
    const endEastButton = page
      .locator("[data-testid='bus-end-stop-group']")
      .getByRole("radio", { name: /东区/ });
    await expect(async () => {
      if (
        (await startWestButton.getAttribute("aria-checked")) !== "true" ||
        (await endEastButton.getAttribute("aria-checked")) !== "true"
      ) {
        await reverseButton.click();
      }
      await expect(startWestButton).toHaveAttribute("aria-checked", "true");
      await expect(endEastButton).toHaveAttribute("aria-checked", "true");
      await expect(routeSectionRows(page)).toHaveCount(1);
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });
    await expect(routeSectionRows(page).first()).toContainText(
      /高新\s*→\s*先研院\s*→\s*西区\s*→\s*东区/,
    );

    await captureStepScreenshot(page, testInfo, "bus-planner-reverse");
  });

  test("选择东区到南区缩小为直达线路", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/catalog/bus", {
      testInfo,
      screenshotLabel: "bus",
    });

    await openRouteControls(page);
    await openFullTimetable(page);
    await chooseStop(page, /End stop|到达站/, /南区/);

    await expect(routeSectionRows(page)).toHaveCount(1);
    await expect(routeSectionRows(page).first()).toContainText(
      /东区\s*→\s*南区/,
    );
    await expect(page.locator("table")).toContainText("南区");
  });

  test("已发车切换保持时刻表可见且可切换", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/catalog/bus", {
      testInfo,
      screenshotLabel: "bus",
    });

    await openRouteControls(page);
    await openFullTimetable(page);
    const initialRows = await page.locator("tbody tr").count();
    const departedToggle = page.getByRole("switch", {
      name: /Show departed trips|显示已发车班次/,
    });
    await departedToggle.click();
    await expect(page.locator("table").first()).toBeVisible();
    const expandedRows = await page.locator("tbody tr").count();
    expect(expandedRows).toBeGreaterThanOrEqual(initialRows);

    await departedToggle.click();
    await expect(page.locator("table").first()).toBeVisible();
  });

  test("工作日/周末切换更新所选线路时刻表", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/catalog/bus", {
      testInfo,
      screenshotLabel: "bus",
    });

    await openRouteControls(page);
    await openFullTimetable(page);
    await page
      .getByRole("switch", { name: /Show departed trips|显示已发车班次/ })
      .click();

    await page
      .getByRole("radio", { name: /Weekday|工作日/ })
      .first()
      .click();
    const weekdayRows = await page.locator("tbody tr:visible").count();
    expect(weekdayRows).toBeGreaterThan(0);

    await page
      .getByRole("radio", { name: /Weekend|周末/ })
      .first()
      .click();
    await expect(page.locator("tbody tr:visible").first()).toBeVisible();
    const weekendRows = await page.locator("tbody tr:visible").count();
    expect(weekendRows).toBeGreaterThan(0);
    expect(weekendRows).not.toBe(weekdayRows);

    await captureStepScreenshot(page, testInfo, "bus-planner-daytype");
  });

  test("280px 与 320px 公共规划器无页面溢出且主要操作达到触控高度", async ({
    page,
  }) => {
    for (const width of [280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndWaitForReady(page, "/catalog/bus");
      const summary = page.getByTestId("bus-compact-summary");
      await expect(summary).toBeVisible();

      await expectMinimumTargetHeight(page, [
        /Change route|调整路线/,
        /Hide full timetable|收起完整时刻表/,
      ]);
      for (const target of [
        summary.getByRole("button", { name: /Reverse|反向/ }),
        summary.getByRole("link", { name: /Transit map|线路图/ }),
      ]) {
        expect(
          (await target.boundingBox())?.height ?? 0,
        ).toBeGreaterThanOrEqual(44);
      }

      await openRouteControls(page);
      await expectMinimumTargetHeight(page, [/Reverse|反向/]);
      const campusTargets = page.locator(
        "[data-testid='bus-start-stop-group'] [role='radio']",
      );
      expect(await campusTargets.count()).toBeGreaterThan(0);
      for (const target of await campusTargets.all()) {
        expect(
          (await target.boundingBox())?.height ?? 0,
        ).toBeGreaterThanOrEqual(44);
      }
      await openFullTimetable(page);
      await expectDiscoverableTimetableScroll(page);
      await expectNoPageHorizontalOverflow(page);
    }
  });

  test("280px 登录规划器与时刻表保持在页面宽度内", async ({ page }) => {
    await page.setViewportSize({ width: 280, height: 900 });
    await signInAsDebugUser(page, "/catalog/bus");
    await gotoAndWaitForReady(page, "/catalog/bus");

    const mapLink = page
      .getByRole("main")
      .getByRole("link", { name: /Transit map|线路图/ })
      .last();
    expect((await mapLink.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
      44,
    );
    await expectMinimumTargetHeight(page, [/Reverse|反向/]);
    await expectNoPageHorizontalOverflow(page);
  });

  test("登录规划器自动保存到校车偏好设置", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/catalog/bus");
    const user = await getCurrentSessionUser(page);
    const originalResponse = await page.request.get(
      "/api/workspace/bus-preferences",
    );
    expect(originalResponse.status()).toBe(200);
    const original = (await originalResponse.json()) as {
      preference?: {
        preferredDestinationCampusId?: number | null;
        preferredOriginCampusId?: number | null;
        showDepartedTrips?: boolean;
      };
    };

    try {
      await page.request.post("/api/workspace/bus-preferences", {
        data: {
          preferredOriginCampusId: null,
          preferredDestinationCampusId: null,
          showDepartedTrips: false,
        },
      });
      await gotoAndWaitForReady(page, "/catalog/bus", {
        testInfo,
        screenshotLabel: "bus",
      });
      await openRouteControls(page);

      const departedToggle = page.getByRole("switch", {
        name: /Show departed trips|显示已发车班次/,
      });
      const [toggleSaveResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/api/workspace/bus-preferences") &&
            response.request().method() === "POST",
        ),
        departedToggle.click(),
      ]);
      expect(toggleSaveResponse.ok()).toBe(true);

      const endSouthButton = page
        .locator("[data-testid='bus-end-stop-group']")
        .getByRole("radio", { name: /南区/ });
      if ((await endSouthButton.getAttribute("aria-checked")) !== "true") {
        const [stopSaveResponse] = await Promise.all([
          page.waitForResponse(
            (response) =>
              response.url().includes("/api/workspace/bus-preferences") &&
              response.request().method() === "POST",
          ),
          endSouthButton.click(),
        ]);
        expect(stopSaveResponse.ok()).toBe(true);
      }

      const response = await page.request.get("/api/workspace/bus-preferences");
      const body = (await response.json()) as {
        preference?: {
          preferredOriginCampusId?: number | null;
          preferredDestinationCampusId?: number | null;
        };
      };
      expect(body.preference?.preferredOriginCampusId).toBe(1);
      expect(body.preference?.preferredDestinationCampusId).toBe(4);

      await captureStepScreenshot(page, testInfo, "bus-planner-autosave");
    } finally {
      await setBusPreferenceFixture(user.id, {
        preferredOriginCampusId:
          original.preference?.preferredOriginCampusId ?? null,
        preferredDestinationCampusId:
          original.preference?.preferredDestinationCampusId ?? null,
        showDepartedTrips: original.preference?.showDepartedTrips ?? false,
      });
    }
  });

  test("登录规划器显示偏好保存失败", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/catalog/bus");
    await page.route("**/api/workspace/bus-preferences", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      await route.fulfill({
        body: JSON.stringify({ error: "e2e preference save failure" }),
        contentType: "application/json",
        status: 500,
      });
    });

    await gotoAndWaitForReady(page, "/catalog/bus", {
      testInfo,
      screenshotLabel: "bus-save-error",
    });
    await openRouteControls(page);

    const departedToggle = page.getByRole("switch", {
      name: /Show departed trips|显示已发车班次/,
    });
    const [saveResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/workspace/bus-preferences") &&
          response.request().method() === "POST",
      ),
      departedToggle.click(),
    ]);

    expect(saveResponse.status()).toBe(500);
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: /偏好保存失败|Failed to save preferences/i }),
    ).toBeVisible();
    await captureStepScreenshot(page, testInfo, "bus-planner-autosave-error");
  });
});
