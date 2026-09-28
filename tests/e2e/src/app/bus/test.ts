import { expect, type Page } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import {
  storedBusPreference,
  busTest as test,
} from "../../../utils/personal-preferences-fixture";
import { absoluteTestUrl } from "../../../utils/request-url";
import { captureStepScreenshot } from "../../../utils/screenshot";
import { assertPageContract } from "../_shared/page-contract";

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
  return page.getByTestId("bus-route-section");
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
  await expect(regions.first()).toBeVisible();
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
  // Short stop segments can fit without horizontal overflow on narrow viewports.
  if (overflowIndex < 0) {
    return;
  }

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
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-07-17T03:00:00.000Z"));
  });

  test("bus.public-no-signin", async ({ page }, testInfo) => {
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

  test("bus.public-responsive-planner", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/catalog/bus", {
      testInfo,
      screenshotLabel: "bus",
    });

    const summary = page.getByTestId("bus-compact-summary");
    await expect(summary).toBeHidden();
    await expect(page.getByTestId("bus-responsive-planner")).toBeVisible();
    await expect(
      page.locator("[data-testid='bus-start-stop-group']"),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid='bus-end-stop-group']"),
    ).toBeVisible();
    await expect(page.locator("table:visible").first()).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /Hide full timetable|收起完整时刻表/,
      }),
    ).toBeHidden();
    await expect(
      page.getByRole("radio", { name: /Weekday|工作日/ }).first(),
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
      page.getByRole("main").getByRole("link", { name: /Transit map|线路图/ }),
    ).toHaveCount(0);
    const controls = await page
      .getByTestId("bus-start-stop-group")
      .boundingBox();
    const table = await page.locator("table:visible").first().boundingBox();
    if (!controls || !table)
      throw new Error("Missing desktop planner geometry");
    expect(table.x).toBeGreaterThanOrEqual(controls.x + controls.width);
    expect(await page.locator("tbody tr:visible").count()).toBeGreaterThan(0);
    await captureStepScreenshot(page, testInfo, "bus-planner-public");
  });

  test("bus.public-version-metadata-omitted", async ({
    page,
    baseURL,
    busAccount: _account,
  }, testInfo) => {
    const sessionCookies = await page.context().cookies();
    await page.context().clearCookies();
    await setLocale(page, baseURL, "zh-cn");
    await gotoAndWaitForReady(page, "/catalog/bus");
    await expect(
      page.getByText(DEV_SEED.bus.versionKey, { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("当前版本", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText("Static Structured Bus Timetable", { exact: true }),
    ).toHaveCount(0);
    await captureStepScreenshot(page, testInfo, "bus-version-label-zh-public");

    await page.context().addCookies(sessionCookies);
    await setLocale(page, baseURL, "zh-cn");
    await gotoAndWaitForReady(page, "/catalog/bus");
    await expect(
      page.getByText(DEV_SEED.bus.versionKey, { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("当前版本", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText("Static Structured Bus Timetable", { exact: true }),
    ).toHaveCount(0);

    await setLocale(page, baseURL, "en-us");
    await gotoAndWaitForReady(page, "/catalog/bus");
    await expect(
      page.getByText(DEV_SEED.bus.versionKey, { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("Active version", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByText("Static Structured Bus Timetable", { exact: true }),
    ).toHaveCount(0);
  });

  test("登录校车面板 SSR 渲染服务端时刻表数据", async ({
    page,
    busAccount: _account,
  }) => {
    await gotoAndWaitForReady(page, "/catalog/bus");

    const response = await page.request.get("/catalog/bus");
    expect(response.status()).toBe(200);
    const html = await response.text();

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

    expect(html).not.toMatch(
      /data-slot="alert"[\s\S]{0,240}当前暂无可用的校车数据。/,
    );
    expect(html).not.toMatch(
      /data-slot="alert"[\s\S]{0,240}No shuttle data is available right now\./,
    );
  });

  test("bus.mobile-full-timetable", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, "/catalog/bus", {
      testInfo,
      screenshotLabel: "bus-mobile",
    });

    const summary = page.getByTestId("bus-compact-summary");
    await expect(summary).toBeVisible();
    await expect(summary.locator("p.font-mono").first()).toHaveCSS(
      "font-size",
      "36px",
    );
    await expect(page.locator("table:visible").first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);

    const hideTimetable = page.getByRole("button", {
      name: /Hide full timetable|收起完整时刻表/,
    });
    await expect(hideTimetable).toBeVisible();
    await hideTimetable.click();
    await expect(page.locator("table:visible")).toHaveCount(0);
    await openFullTimetable(page);
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
    // Seed stop-pair yields two primary routes; additional applicable routes
    // may also render depending on timetable data.
    expect(await routeSectionRows(page).count()).toBeGreaterThanOrEqual(2);
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

  test("工作日/周日切换更新所选线路时刻表", async ({ page }, testInfo) => {
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
      .getByRole("radio", { name: /Sunday|周日/ })
      .first()
      .click();
    await expect(page.locator("tbody tr:visible").first()).toBeVisible();
    const sundayRows = await page.locator("tbody tr:visible").count();
    expect(sundayRows).toBeGreaterThan(0);
    expect(sundayRows).not.toBe(weekdayRows);

    await captureStepScreenshot(page, testInfo, "bus-planner-daytype");
  });

  test("bus.primary-route-action-size", async ({ page }) => {
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

  test("280px 登录规划器与时刻表保持在页面宽度内", async ({
    page,
    busAccount: _account,
  }) => {
    await page.setViewportSize({ width: 280, height: 900 });
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

  test("登录规划器自动保存到校车偏好设置", async ({
    page,
    busPreferences,
    isolatedWorker,
  }, testInfo) => {
    const db = isolatedWorker.database.owner;
    expect(await storedBusPreference(db, busPreferences.id)).toEqual({
      preferredOriginCampusId: null,
      preferredDestinationCampusId: null,
      showDepartedTrips: false,
    });
    await gotoAndWaitForReady(page, "/catalog/bus", {
      testInfo,
      screenshotLabel: "bus",
    });
    await openRouteControls(page);
    const departedToggle = page.getByRole("switch", {
      name: /Show departed trips|显示已发车班次/,
    });
    await expect(departedToggle).not.toBeChecked();
    const [toggleSaveResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/workspace/bus-preferences") &&
          response.request().method() === "POST",
      ),
      departedToggle.click(),
    ]);
    expect(toggleSaveResponse.ok()).toBe(true);
    await expect(departedToggle).toBeChecked();
    const endSouthButton = page
      .locator("[data-testid='bus-end-stop-group']")
      .getByRole("radio", { name: /南区/ });
    await expect(endSouthButton).toHaveAttribute("aria-checked", "false");
    const [stopSaveResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/workspace/bus-preferences") &&
          response.request().method() === "POST",
      ),
      endSouthButton.click(),
    ]);
    expect(stopSaveResponse.ok()).toBe(true);
    const response = await page.request.get("/api/workspace/bus-preferences");
    expect(response.status()).toBe(200);
    const body = await response.json();
    const expected = {
      preferredOriginCampusId: 1,
      preferredDestinationCampusId: 4,
      showDepartedTrips: true,
    };
    expect(body.preference).toMatchObject(expected);
    await expect
      .poll(() => storedBusPreference(db, busPreferences.id))
      .toEqual(expected);
    await captureStepScreenshot(page, testInfo, "bus-planner-autosave");

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForUiSettled(page);
    await openRouteControls(page);
    await expect(departedToggle).toBeChecked();
    await expect(
      page
        .locator("[data-testid='bus-start-stop-group']")
        .getByRole("radio", { name: /东区/ }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(endSouthButton).toHaveAttribute("aria-checked", "true");
  });
});

test("页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/catalog/bus", testInfo });
});
