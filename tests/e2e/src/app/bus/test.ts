/**
 * E2E tests for the bus dashboard tab (/dashboard/bus)
 *
 * ## Behavior
 * - /bus page returns 404
 * - Public users get a client-side planner: weekday/weekend, start stop, end stop,
 *   reverse, and departed-trip toggle
 * - Applicable routes are ordered by the next bus available from the selected start stop
 * - Signed-in users have planner defaults auto-saved through /api/bus/preferences
 */
import { expect, type Page, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../utils/auth";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";

async function chooseStop(page: Page, label: RegExp, option: RegExp) {
  const group =
    label.source.includes("Start") || label.source.includes("出发")
      ? page.locator("[data-testid='bus-start-stop-group']")
      : page.locator("[data-testid='bus-end-stop-group']");
  const button = group.getByRole("button", { name: option });
  await expect(async () => {
    if ((await button.getAttribute("aria-pressed")) !== "true") {
      await button.click();
    }
    await expect(button).toHaveAttribute("aria-pressed", "true");
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

test.describe("bus dashboard tab", () => {
  test.describe.configure({ mode: "serial" });

  test("/bus returns 404 (redirect removed)", async ({ page }) => {
    const response = await page.goto("/bus");
    expect(response?.status()).toBe(404);
  });

  test("legacy query tab still renders the bus planner", async ({ page }) => {
    await gotoAndWaitForReady(page, "/?tab=bus", {
      screenshotLabel: "bus-legacy",
    });

    await expect(
      page.getByRole("link", { name: /Transit map|线路图/ }),
    ).toHaveAttribute("href", "/bus-map");
  });

  test("public bus tab shows the planner controls", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=bus", {
      testInfo,
      screenshotLabel: "bus",
    });

    await expect(
      page.getByRole("button", { name: /Weekday|工作日/ }).first(),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid='bus-start-stop-group']"),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid='bus-end-stop-group']"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Reverse|反向/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", {
        name: /Show departed trips|显示已发车班次/,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Transit map|线路图/ }),
    ).toHaveAttribute("href", "/bus-map");

    await captureStepScreenshot(page, testInfo, "bus-planner-public");
  });

  test("signed bus dashboard SSR renders server timetable data", async ({
    page,
  }) => {
    await signInAsDebugUser(page, "/dashboard/bus");

    const response = await page.request.get("/dashboard/bus");
    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(html).toContain('href="/bus-map"');
    expect(html).not.toMatch(
      /data-slot="alert"[\s\S]{0,240}当前暂无可用的校车数据。/,
    );
    expect(html).not.toMatch(
      /data-slot="alert"[\s\S]{0,240}No shuttle data is available right now\./,
    );
  });

  test("anonymous bus dashboard SSR renders public timetable data", async ({
    page,
  }) => {
    const response = await page.request.get("/?tab=bus");
    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(html).toContain('href="/bus-map"');
    expect(html).not.toMatch(
      /data-slot="alert"[\s\S]{0,240}当前暂无可用的校车数据。/,
    );
    expect(html).not.toMatch(
      /data-slot="alert"[\s\S]{0,240}No shuttle data is available right now\./,
    );
  });

  test("public bus tab keeps planner controls usable on mobile", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, "/?tab=bus", {
      testInfo,
      screenshotLabel: "bus-mobile",
    });

    await expect(
      page.getByRole("button", { name: /Weekday|工作日/ }).first(),
    ).toBeVisible();
    await expect(
      page.locator("[data-testid='bus-start-stop-group']"),
    ).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible();

    await captureStepScreenshot(page, testInfo, "bus-planner-public-mobile");
  });

  test("default stop pair shows every applicable route ordered by next available bus", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=bus", {
      testInfo,
      screenshotLabel: "bus",
    });

    await expect(routeSectionRows(page)).toHaveCount(2);
    const routeTexts = await routeSectionRows(page).allTextContents();
    expect(
      routeTexts.some((text) => text.includes("东区 -> 北区 -> 西区")),
    ).toBe(true);
    expect(
      routeTexts.some((text) =>
        text.includes("东区 -> 西区 -> 先研院 -> 高新"),
      ),
    ).toBe(true);
  });

  test("reverse swaps direction and recomputes applicable routes", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=bus", {
      testInfo,
      screenshotLabel: "bus",
    });

    const reverseButton = page.getByRole("button", { name: /Reverse|反向/ });
    const startWestButton = page
      .locator("[data-testid='bus-start-stop-group']")
      .getByRole("button", { name: /西区/ });
    const endEastButton = page
      .locator("[data-testid='bus-end-stop-group']")
      .getByRole("button", { name: /东区/ });
    await expect(async () => {
      if (
        (await startWestButton.getAttribute("aria-pressed")) !== "true" ||
        (await endEastButton.getAttribute("aria-pressed")) !== "true"
      ) {
        await reverseButton.click();
      }
      await expect(startWestButton).toHaveAttribute("aria-pressed", "true");
      await expect(endEastButton).toHaveAttribute("aria-pressed", "true");
      await expect(routeSectionRows(page)).toHaveCount(1);
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });
    await expect(routeSectionRows(page).first()).toContainText(
      "高新 -> 先研院 -> 西区 -> 东区",
    );

    await captureStepScreenshot(page, testInfo, "bus-planner-reverse");
  });

  test("selecting 东区 to 南区 narrows the list to the direct route", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=bus", {
      testInfo,
      screenshotLabel: "bus",
    });

    await chooseStop(page, /End stop|到达站/, /南区/);

    await expect(routeSectionRows(page)).toHaveCount(1);
    await expect(routeSectionRows(page).first()).toContainText("东区 -> 南区");
    await expect(page.locator("table")).toContainText("南区");
  });

  test("departed toggle keeps the timetable visible and switchable", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=bus", {
      testInfo,
      screenshotLabel: "bus",
    });

    const initialRows = await page.locator("tbody tr").count();
    const departedToggle = page.getByRole("checkbox", {
      name: /Show departed trips|显示已发车班次/,
    });
    await departedToggle.click();
    await expect(page.locator("table").first()).toBeVisible();
    const expandedRows = await page.locator("tbody tr").count();
    expect(expandedRows).toBeGreaterThanOrEqual(initialRows);

    await departedToggle.click();
    await expect(page.locator("table").first()).toBeVisible();
  });

  test("weekday/weekend toggle updates the selected route timetable", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=bus", {
      testInfo,
      screenshotLabel: "bus",
    });

    await page
      .getByRole("checkbox", { name: /Show departed trips|显示已发车班次/ })
      .click();

    await page
      .getByRole("button", { name: /Weekday|工作日/ })
      .first()
      .click();
    const weekdayRows = await page.locator("tbody tr:visible").count();
    expect(weekdayRows).toBeGreaterThan(0);

    await page
      .getByRole("button", { name: /Weekend|周末/ })
      .first()
      .click();
    await expect(page.locator("tbody tr:visible").first()).toBeVisible();
    const weekendRows = await page.locator("tbody tr:visible").count();
    expect(weekendRows).toBeGreaterThan(0);
    expect(weekendRows).not.toBe(weekdayRows);

    await captureStepScreenshot(page, testInfo, "bus-planner-daytype");
  });

  test("signed-in planner changes auto-save to bus preferences", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/bus");
    const originalResponse = await page.request.get("/api/bus/preferences");
    expect(originalResponse.status()).toBe(200);
    const original = (await originalResponse.json()) as {
      preference?: {
        preferredDestinationCampusId?: number | null;
        preferredOriginCampusId?: number | null;
        showDepartedTrips?: boolean;
      };
    };

    try {
      await page.request.post("/api/bus/preferences", {
        data: {
          preferredOriginCampusId: null,
          preferredDestinationCampusId: null,
          showDepartedTrips: false,
        },
      });
      await gotoAndWaitForReady(page, "/dashboard/bus", {
        testInfo,
        screenshotLabel: "bus",
      });

      const departedToggle = page.getByRole("checkbox", {
        name: /Show departed trips|显示已发车班次/,
      });
      const [toggleSaveResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/api/bus/preferences") &&
            response.request().method() === "POST",
        ),
        departedToggle.click(),
      ]);
      expect(toggleSaveResponse.ok()).toBe(true);

      const endSouthButton = page
        .locator("[data-testid='bus-end-stop-group']")
        .getByRole("button", { name: /南区/ });
      if ((await endSouthButton.getAttribute("aria-pressed")) !== "true") {
        const [stopSaveResponse] = await Promise.all([
          page.waitForResponse(
            (response) =>
              response.url().includes("/api/bus/preferences") &&
              response.request().method() === "POST",
          ),
          endSouthButton.click(),
        ]);
        expect(stopSaveResponse.ok()).toBe(true);
      }

      const response = await page.request.get("/api/bus/preferences");
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
      const restoreResponse = await page.request.post("/api/bus/preferences", {
        data: {
          preferredOriginCampusId:
            original.preference?.preferredOriginCampusId ?? null,
          preferredDestinationCampusId:
            original.preference?.preferredDestinationCampusId ?? null,
          showDepartedTrips: original.preference?.showDepartedTrips ?? false,
        },
      });
      expect(restoreResponse.status()).toBe(200);
    }
  });

  test("signed-in planner shows preference save failures", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/bus");
    await page.route("**/api/bus/preferences", async (route) => {
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

    await gotoAndWaitForReady(page, "/dashboard/bus", {
      testInfo,
      screenshotLabel: "bus-save-error",
    });

    const departedToggle = page.getByRole("checkbox", {
      name: /Show departed trips|显示已发车班次/,
    });
    const [saveResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes("/api/bus/preferences") &&
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
