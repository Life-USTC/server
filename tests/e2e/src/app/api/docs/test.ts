/**
 * E2E tests for /api/docs
 */
import { expect, type Page, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { capturePageScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

async function setLocale(page: Page, locale: "en-us" | "zh-cn") {
  const response = await page.request.post("/api/account/preferences", {
    data: { locale },
  });
  expect(response.ok()).toBe(true);
}

async function waitForSectionsReference(page: Page) {
  const reference = page.locator("#api-reference");
  await expect(reference).toContainText("List sections", { timeout: 30_000 });
  return reference;
}

test.describe("/api/docs 页面", () => {
  test("接口契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/api/docs/tag/sections",
      testInfo,
    });
  });

  test("渲染 API 参考容器", async ({ page }) => {
    await gotoAndWaitForReady(page, "/api/docs/tag/sections", {
      waitUntil: "load",
    });
    await expect(page.locator("#api-reference")).toBeVisible();
  });

  test("移动端优先展示参考内容并用抽屉浏览完整导航", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setLocale(page, "zh-cn");
    await gotoAndWaitForReady(page, "/api/docs/tag/sections", {
      waitUntil: "load",
    });
    const reference = await waitForSectionsReference(page);
    const mobileTrigger = page.getByTestId(
      "api-docs-mobile-navigation-trigger",
    );

    await expect(mobileTrigger).toHaveAccessibleName("浏览 API 接口");
    await expect(mobileTrigger).toBeVisible();
    await expect(page.getByTestId("api-docs-desktop-navigation")).toBeHidden();

    const initialMetrics = await reference.evaluate((element) => ({
      documentY: element.getBoundingClientRect().top + window.scrollY,
      scrollY: window.scrollY,
      viewportHeight: window.innerHeight,
      hasBodyOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    }));
    expect(initialMetrics.scrollY).toBe(0);
    expect(initialMetrics.documentY).toBeLessThan(
      initialMetrics.viewportHeight,
    );
    expect(initialMetrics.viewportHeight).toBe(844);
    expect(initialMetrics.hasBodyOverflow).toBe(false);
    await capturePageScreenshot(page, testInfo, {
      url: "api-docs/mobile-reference",
    });

    await mobileTrigger.click();
    const panel = page.getByTestId("api-docs-mobile-navigation-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveRole("dialog");
    await expect(panel).toHaveAccessibleName("API 导航");
    await expect(
      panel.getByRole("heading", { name: "API 导航" }),
    ).toBeVisible();
    await expect(
      panel.getByRole("link", { name: "Sections", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    const desktopNavigation = page.getByTestId("api-docs-desktop-navigation");
    expect(await panel.getByRole("link").count()).toBe(
      await desktopNavigation
        .getByRole("link", { includeHidden: true })
        .count(),
    );
    await expect
      .poll(() =>
        panel.evaluate((element) => getComputedStyle(element).overflowY),
      )
      .toBe("auto");
    await capturePageScreenshot(page, testInfo, {
      url: "api-docs/mobile-navigation",
    });

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(mobileTrigger).toBeFocused();

    await mobileTrigger.click();
    await panel
      .getByRole("link", { name: "GET List sections", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/api\/docs\/tag\/sections\/GET\/api\/catalog\/sections$/,
    );
    await expect(panel).toBeHidden();
    await expect(reference).toContainText("List sections");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    const operationDocumentY = await reference.evaluate(
      (element) => element.getBoundingClientRect().top + window.scrollY,
    );
    expect(operationDocumentY).toBeLessThan(844);
    await mobileTrigger.click();
    await expect(
      panel.getByRole("link", { name: "GET List sections", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await capturePageScreenshot(page, testInfo, {
      url: "api-docs/mobile-operation-reference",
    });
  });

  test("桌面端保留完整固定导航", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setLocale(page, "en-us");
    await gotoAndWaitForReady(page, "/api/docs/tag/sections", {
      waitUntil: "load",
    });
    const reference = await waitForSectionsReference(page);
    const sidebar = page.getByTestId("api-docs-desktop-navigation");

    await expect(sidebar).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Sections", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByTestId("api-docs-mobile-navigation-trigger"),
    ).toBeHidden();

    const [sidebarBox, referenceBox] = await Promise.all([
      sidebar.boundingBox(),
      reference.boundingBox(),
    ]);
    expect(sidebarBox).not.toBeNull();
    expect(referenceBox).not.toBeNull();
    expect(sidebarBox?.x ?? 0).toBeLessThan(referenceBox?.x ?? 0);
    expect(
      await sidebar.evaluate((element) => getComputedStyle(element).position),
    ).toBe("sticky");
    await capturePageScreenshot(page, testInfo, {
      url: "api-docs/desktop-navigation",
    });
  });

  test("使用路径导航而非哈希导航", async ({ page }) => {
    await gotoAndWaitForReady(page, "/api/docs/tag/sections", {
      waitUntil: "load",
    });
    await page
      .getByRole("link", { name: "GET List sections", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/api\/docs\/tag\/sections\/GET\/api\/catalog\/sections$/,
    );
  });

  test("根路径重定向到第一个路由分组", async ({ page }) => {
    await page.goto("/api/docs");
    await expect(page).toHaveURL(/\/api\/docs\/tag\/sections$/);
  });
});

test.describe("/api-docs 页面", () => {
  test("重定向到 /api/docs", async ({ page }) => {
    await page.goto("/api-docs");
    await expect(page).toHaveURL(/\/api\/docs\/tag\/sections$/);
  });
});
