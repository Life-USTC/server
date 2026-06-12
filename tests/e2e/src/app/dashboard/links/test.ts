/**
 * E2E tests for the links dashboard (`/dashboard/links`)
 *
 * ## Data Represented
 * - Dashboard links grouped by category (study, life, tech, classroom, etc.)
 *   sourced from USTC_DASHBOARD_LINKS
 * - Each link card: name, description, visit tracking via
 *   POST /api/dashboard-links/visit
 * - Pin state per user via POST /api/dashboard-links/pin
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
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe.configure({ mode: "serial" });

const PIN_LABEL = /^(?:置顶|Pin)$/i;
const UNPIN_LABEL = /^(?:取消置顶|Unpin)$/i;
const JSON_HEADERS = { accept: "application/json" };

test.describe("dashboard links", () => {
  test("public ?tab=links shows search and links without pin controls", async ({
    page,
  }, testInfo) => {
    await gotoAndWaitForReady(page, "/?tab=links");

    const searchInput = page.getByRole("searchbox", {
      name: /搜索网站名称或描述|Search by name or description/i,
    });
    await expect(searchInput).toBeVisible();
    await expect(
      page.getByRole("button", { name: /教务系统/i }).first(),
    ).toBeVisible();

    // No pin forms in public view
    await expect(
      page.locator('form[action="/api/dashboard-links/pin"]').first(),
    ).toHaveCount(0);

    await captureStepScreenshot(page, testInfo, "public-dashboard-links-tab");
  });

  test("authenticated can navigate to links tab", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/");

    const linksTab = page.getByRole("tab", { name: /网站|Websites/i }).first();
    await expect(linksTab).toBeVisible();
    await linksTab.click();

    await expect(page).toHaveURL(/\/dashboard\/links$/);
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

  test("search filters links", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/links");

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

  test("can pin and unpin a link with state restoration", async ({
    page,
  }, testInfo) => {
    await signInAsDebugUser(page, "/dashboard/links");
    await page.request.post("/api/dashboard-links/pin", {
      form: { slug: "jw", action: "unpin", returnTo: "/dashboard/links" },
      headers: JSON_HEADERS,
    });
    await gotoAndWaitForReady(page, "/dashboard/links", {
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
        .locator('form[action="/api/dashboard-links/pin"]')
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
            res.url().includes("/api/dashboard-links/pin") &&
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
      await page.request.post("/api/dashboard-links/pin", {
        form: { slug: "jw", action: "pin", returnTo: "/dashboard/links" },
        headers: JSON_HEADERS,
      });
    }
  });
});
