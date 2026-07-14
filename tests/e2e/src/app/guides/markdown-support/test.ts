/**
 * E2E tests for /guides/markdown-support page
 *
 * Static documentation page showcasing Markdown features supported in comments.
 */
import { expect, test } from "@playwright/test";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

test.describe("/guides/markdown-support Markdown 支持页", () => {
  test("页面契约", async ({ page }, testInfo) => {
    await assertPageContract(page, {
      routePath: "/guides/markdown-support",
      testInfo,
    });
  });

  test("渲染 Markdown 指南，包含代码块与表格", async ({ page }) => {
    await gotoAndWaitForReady(page, "/guides/markdown-support", {
      waitUntil: "load",
    });
    await waitForUiSettled(page);

    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("pre").first()).toContainText("**Bold**");

    // Should contain a table
    await expect(page.locator("table").first()).toBeVisible();
  });

  test("KaTeX Size3 字体在 CSP 下可加载", async ({ page }, testInfo) => {
    const fontConsoleErrors: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (
        message.type() === "error" &&
        /data:font|font-src|KaTeX_Size3/i.test(text)
      ) {
        fontConsoleErrors.push(text);
      }
    });

    await gotoAndWaitForReady(page, "/guides/markdown-support", {
      waitUntil: "load",
    });
    await waitForUiSettled(page);
    await expect(page.locator(".katex-display").first()).toBeVisible();

    const fontLoaded = await page.evaluate(async () => {
      const probe = document.createElement("span");
      probe.style.fontFamily = "KaTeX_Size3";
      probe.style.fontSize = "32px";
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.textContent = "∫";
      document.body.append(probe);

      try {
        await document.fonts.load("32px KaTeX_Size3", probe.textContent);
        await document.fonts.ready;
        return document.fonts.check("32px KaTeX_Size3", probe.textContent);
      } finally {
        probe.remove();
      }
    });

    expect(fontLoaded).toBe(true);
    expect(fontConsoleErrors).toEqual([]);
    await captureStepScreenshot(page, testInfo, "katex-size3-font-loaded");
  });
});
