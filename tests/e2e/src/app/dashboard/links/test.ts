/**
 * E2E tests for the links dashboard (`/catalog/links`)
 *
 * ## Data Represented
 * - Dashboard links grouped by category (study, life, tech, classroom, etc.)
 *   sourced from USTC_DASHBOARD_LINKS
 * - Each link card: name, description, visit tracking via
 *   POST /api/catalog/links/resolve
 * - Pin state per user via POST /api/workspace/link-pins
 *
 * ## UI/UX Elements
 * - Search box to filter links by name/description
 * - Ctrl+K / Cmd+K keyboard shortcut focuses search
 * - Pin/unpin button per card (visible on hover, authenticated only)
 * - Group labels (study, life, tech…) shown in "all" variant
 * - Credit text linking to SmartHypercube/ustclife repo
 *
 * ## Edge Cases
 * - Public view: search works but pin buttons are hidden (allowPinning=false)
 * - Pin/unpin is a stateful action — tests restore original state after toggle
 * - Search filters across all groups; empty search restores full list
 */
import { expect, type Page, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import {
  expandSidebarGroup,
  sidebarNavigationLink,
} from "../../../../utils/locators";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe.configure({ mode: "serial" });

const PIN_LABEL = /^(?:置顶|Pin)$/i;
const UNPIN_LABEL = /^(?:取消置顶|Unpin)$/i;
const JSON_HEADERS = { accept: "application/json" };

async function setLocale(page: Page, locale: "en-us" | "zh-cn") {
  const response = await page.request.post("/api/account/preferences", {
    data: { locale },
  });
  expect(response.status()).toBe(200);
}

test.describe("仪表盘网站链接", () => {
  test("公共 /links 显示搜索和链接，无置顶控件", async ({ page }, testInfo) => {
    await setLocale(page, "zh-cn");
    const response = await gotoAndWaitForReady(page, "/catalog/links");

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/links$/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/links$/,
    );
    const searchInput = page.getByRole("searchbox", {
      name: /搜索网站名称或描述|Search by name or description/i,
    });
    await expect(searchInput).toBeVisible();
    await expect(
      page.getByRole("button", { name: /教务系统/i }).first(),
    ).toBeVisible();

    // No pin forms in public view
    await expect(
      page.locator('form[action="/api/workspace/link-pins"]').first(),
    ).toHaveCount(0);

    await captureStepScreenshot(page, testInfo, "public-dashboard-links-tab");
  });

  test("旧版 links 查询标签永久重定向到语义路径", async ({ page }) => {
    const response = await page.request.get(
      "/?tab=links&linkView=list&utm_source=bookmark",
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(
      "/catalog/links?linkView=list&utm_source=bookmark",
    );
  });

  test("公共英文链接页面在搜索中使用本地化标题", async ({ page }, testInfo) => {
    await setLocale(page, "en-us");

    await gotoAndWaitForReady(page, "/catalog/links");

    const searchInput = page.getByRole("searchbox", {
      name: /Search by name or description/i,
    });
    await expect(searchInput).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Academic Affairs System/i }).first(),
    ).toBeVisible();

    await expect(async () => {
      await searchInput.click();
      await searchInput.clear();
      await searchInput.pressSequentially("email");
      await expect(
        page.getByRole("button", { name: /USTC Email/i }).first(),
      ).toBeVisible({ timeout: 3_000 });
      await expect(
        page.getByRole("button", { name: /Academic Affairs System/i }),
      ).toHaveCount(0, { timeout: 3_000 });
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });

    await captureStepScreenshot(
      page,
      testInfo,
      "public-dashboard-links-en-search",
    );
  });

  test("登录后可以导航到链接标签", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/");
    await expandSidebarGroup(page, /^(发现|Explore)$/i);

    const linksTab = sidebarNavigationLink(page, /^(网站|Websites)$/i);
    await expect(linksTab).toBeVisible();
    await linksTab.click();

    await expect(page).toHaveURL(/\/catalog\/links$/);
    await expect(
      page.getByRole("searchbox", {
        name: /搜索网站名称或描述|Search by name or description/i,
      }),
    ).toBeVisible();
    await expect(
      page.locator('input[name="action"][value="unpin"]'),
    ).toHaveCount(DEV_SEED.dashboardLinks.overviewLimit);

    await captureStepScreenshot(page, testInfo, "dashboard-links-tab");
  });

  test("搜索可筛选链接", async ({ page }, testInfo) => {
    await setLocale(page, "zh-cn");
    await signInAsDebugUser(page, "/catalog/links");

    const searchInput = page.getByRole("searchbox", {
      name: /搜索网站名称或描述|Search by name or description/i,
    });
    await expect(searchInput).toBeVisible();
    await page.keyboard.press("Control+K");
    await expect(searchInput).toBeFocused();

    // Search for a specific link
    await expect(async () => {
      await searchInput.click();
      await searchInput.clear();
      await searchInput.pressSequentially("邮箱");
      await expect(
        page.getByRole("button", { name: /邮箱/i }).first(),
      ).toBeVisible({ timeout: 3_000 });
      await expect(
        page.getByRole("button", { name: /教务系统/i }).first(),
      ).toHaveCount(0);
    }).toPass({
      timeout: 10_000,
      intervals: [250, 500, 1_000],
    });

    await captureStepScreenshot(page, testInfo, "dashboard-links-search");
  });

  test("可以置顶和取消置顶链接并恢复状态", async ({ page }, testInfo) => {
    await setLocale(page, "zh-cn");
    await signInAsDebugUser(page, "/catalog/links");
    await page.request.post("/api/workspace/link-pins", {
      form: { slug: "jw", action: "unpin", returnTo: "/catalog/links" },
      headers: JSON_HEADERS,
    });
    await gotoAndWaitForReady(page, "/catalog/links", {
      testInfo,
      screenshotLabel: "dashboard-links",
    });

    const locatePinButton = async () => {
      const linkButton = page
        .getByRole("button", { name: /教务系统/i })
        .first();
      await expect(linkButton).toBeVisible();

      const card = linkButton.locator(
        "xpath=ancestor::div[contains(@class, 'group')][1]",
      );
      await card.hover();

      const pinForm = page
        .locator('form[action="/api/workspace/link-pins"]')
        .filter({
          has: page.locator('input[name="slug"][value="jw"]'),
        })
        .first();
      const pinButton = pinForm
        .getByRole("button", { name: /置顶|Pin|取消置顶|Unpin/i })
        .first();

      await expect(pinButton).toBeVisible();
      return pinButton;
    };

    async function clickPinButtonAndWait() {
      const currentPinButton = await locatePinButton();
      const [response] = await Promise.all([
        page.waitForResponse(
          (res) =>
            res.url().includes("/api/workspace/link-pins") &&
            res.request().method() === "POST",
        ),
        currentPinButton.click({ force: true }),
      ]);
      expect(response.ok()).toBe(true);
      await page.reload({ waitUntil: "domcontentloaded" });
    }

    try {
      await expect(await locatePinButton()).toHaveAttribute(
        "aria-label",
        PIN_LABEL,
      );

      await expect(async () => {
        const currentPinButton = await locatePinButton();
        const currentLabel = await currentPinButton.getAttribute("aria-label");
        if (!UNPIN_LABEL.test(currentLabel ?? "")) {
          await clickPinButtonAndWait();
        }
        await expect(await locatePinButton()).toHaveAttribute(
          "aria-label",
          UNPIN_LABEL,
        );
      }).toPass({
        timeout: 10_000,
        intervals: [250, 500, 1_000],
      });
      await captureStepScreenshot(
        page,
        testInfo,
        "dashboard-links-toggle-request",
      );

      await expect(async () => {
        const restoreButton = await locatePinButton();
        const restoreLabel = await restoreButton.getAttribute("aria-label");
        if (!PIN_LABEL.test(restoreLabel ?? "")) {
          await clickPinButtonAndWait();
        }
        await expect(await locatePinButton()).toHaveAttribute(
          "aria-label",
          PIN_LABEL,
        );
      }).toPass({
        timeout: 10_000,
        intervals: [250, 500, 1_000],
      });
    } finally {
      await page.request.post("/api/workspace/link-pins", {
        form: { slug: "jw", action: "pin", returnTo: "/catalog/links" },
        headers: JSON_HEADERS,
      });
    }
  });

  test("搜索重新计算链接时保持置顶状态", async ({ page }, testInfo) => {
    await setLocale(page, "zh-cn");
    await signInAsDebugUser(page, "/catalog/links");
    await page.request.post("/api/workspace/link-pins", {
      form: { slug: "jw", action: "unpin", returnTo: "/catalog/links" },
      headers: JSON_HEADERS,
    });
    await gotoAndWaitForReady(page, "/catalog/links");

    const searchInput = page.getByRole("searchbox", {
      name: /搜索网站名称或描述|Search by name or description/i,
    });

    const locateJwPinButton = async () => {
      const linkButton = page
        .getByRole("button", { name: /教务系统/i })
        .first();
      await expect(linkButton).toBeVisible();

      const card = linkButton.locator(
        "xpath=ancestor::div[contains(@class, 'group')][1]",
      );
      await card.hover();

      return page
        .locator('form[action="/api/workspace/link-pins"]')
        .filter({
          has: page.locator('input[name="slug"][value="jw"]'),
        })
        .first()
        .getByRole("button", { name: /置顶|Pin|取消置顶|Unpin/i })
        .first();
    };

    async function submitPinChange(actionLabel: RegExp) {
      const button = await locateJwPinButton();
      await expect(button).toHaveAttribute("aria-label", actionLabel);
      const [response] = await Promise.all([
        page.waitForResponse(
          (res) =>
            res.url().includes("/api/workspace/link-pins") &&
            res.request().method() === "POST",
        ),
        button.click({ force: true }),
      ]);
      expect(response.ok()).toBe(true);
    }

    try {
      await submitPinChange(PIN_LABEL);
      await searchInput.fill("教务");
      await expect(await locateJwPinButton()).toHaveAttribute(
        "aria-label",
        UNPIN_LABEL,
      );

      await submitPinChange(UNPIN_LABEL);
      await searchInput.fill("教务系统");
      await expect(await locateJwPinButton()).toHaveAttribute(
        "aria-label",
        PIN_LABEL,
      );

      await captureStepScreenshot(
        page,
        testInfo,
        "dashboard-links-pin-search-stable",
      );
    } finally {
      await page.request.post("/api/workspace/link-pins", {
        form: { slug: "jw", action: "pin", returnTo: "/catalog/links" },
        headers: JSON_HEADERS,
      });
    }
  });
});
