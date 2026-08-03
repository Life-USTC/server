/**
 * E2E tests for /privacy page
 *
 * Static legal page rendering the privacy policy from i18n keys.
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../utils/auth";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { assertPageContract } from "../_shared/page-contract";

test.describe("/privacy 隐私政策页", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, { routePath: "/privacy", testInfo });
  });

  test("渲染带章节的隐私政策", async ({ page }, testInfo) => {
    await gotoAndWaitForReady(page, "/privacy", {
      testInfo,
      screenshotLabel: "privacy",
    });
    await waitForUiSettled(page);

    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();

    const sections = page.locator("h2");
    await expect(sections.first()).toBeVisible();
    expect(await sections.count()).toBeGreaterThan(0);

    const listItems = page.locator("li");
    expect(await listItems.count()).toBeGreaterThan(0);
  });

  test("登录用户绕过 PublicSsr 缓存并直接 SSR viewer", async ({ page }) => {
    await signInAsDebugUser(page, "/privacy", "/privacy");

    const documentResponse = await page.request.get("/privacy");
    expect(documentResponse.status()).toBe(200);
    expect(documentResponse.headers()["cache-control"]).toMatch(/no-store/);
    const html = await documentResponse.text();
    // Authenticated requests skip anonymous PublicSsr HTML, so the viewer is
    // already present in the document instead of a client-only skeleton.
    expect(html).not.toContain('data-testid="viewer-loading"');
    expect(html).toContain('id="app-user-menu"');

    await gotoAndWaitForReady(page, "/privacy");
    await expect(page.getByTestId("viewer-loading")).toHaveCount(0);
    await expect(page.locator("#app-user-menu")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^(登录|Sign in)$/i }),
    ).toHaveCount(0);
  });
});

test.describe("/privacy 无 JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("SSR 保留完整政策正文", async ({ page }) => {
    await page.goto("/privacy");

    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h2").first()).toBeVisible();
    await expect(page.locator("li").first()).toBeVisible();
  });
});
