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

  test("320px 列表内容在 Card 内完整换行", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await gotoAndWaitForReady(page, "/privacy", { testInfo });

    const overflow = await page
      .locator('[data-slot="card"] .markdown-preview')
      .evaluate((markdown) => {
        const elements = [
          markdown,
          ...Array.from(markdown.querySelectorAll<HTMLElement>("ul, ol, li")),
        ];
        return elements
          .map((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            tag: element.tagName,
          }))
          .filter(
            ({ clientWidth, scrollWidth }) => scrollWidth > clientWidth + 1,
          );
      });

    expect(overflow).toEqual([]);
    await expect(page.locator('[data-slot="card"] li').first()).toBeVisible();
  });

  test("登录用户共享匿名 SSR 并通过私有请求恢复身份", async ({ page }) => {
    await signInAsDebugUser(page, "/privacy", "/privacy");

    const documentResponse = await page.request.get("/privacy");
    expect(documentResponse.status()).toBe(200);
    expect(documentResponse.headers()["cache-control"]).toMatch(/no-store/);
    const html = await documentResponse.text();
    expect(html).toContain('data-testid="viewer-loading"');
    expect(html).not.toContain('id="app-user-menu"');
    const session = await page.request.get("/api/auth/get-session");
    const { user } = await session.json();
    expect(user.id).toBeTruthy();
    expect(html).not.toContain(user.id);

    const bootstrapResponse = page.waitForResponse((response) =>
      response.url().endsWith("/_internal/shell-bootstrap"),
    );
    await gotoAndWaitForReady(page, "/privacy");
    const bootstrap = await bootstrapResponse;
    expect(bootstrap.status()).toBe(200);
    expect(bootstrap.headers()["cache-control"]).toBe("private, no-store");
    expect((await bootstrap.json()).viewer.id).toBe(user.id);
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
