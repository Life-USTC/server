/**
 * E2E tests for /guides/markdown-support page
 *
 * Static documentation page showcasing Markdown features supported in comments.
 */
import { expect } from "@playwright/test";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { test } from "../../../../utils/public-worker";
import { assertPageContract } from "../../_shared/page-contract";

test.describe("/guides/markdown-support Markdown 支持页", () => {
  test("页面契约", async ({ page, publicFlow }) => {
    await publicFlow.run(async () => {
      await assertPageContract(page, {
        routePath: "/guides/markdown-support",
      });
    });
  });

  test("渲染 Markdown 指南，包含代码块与表格", async ({ page, publicFlow }) => {
    await publicFlow.run(async () => {
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
  });

  test("桌面和移动端共享段落间距与首行缩进，图片和列表不缩进", async ({
    page,
    publicFlow,
  }) => {
    await publicFlow.run(async () => {
      await gotoAndWaitForReady(page, "/guides/markdown-support");

      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        const paragraph = page.locator(".markdown-preview > p + p").first();
        const metrics = await paragraph.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            fontSize: Number.parseFloat(style.fontSize),
            indent: Number.parseFloat(style.textIndent),
            gap: Number.parseFloat(style.marginBlockStart),
          };
        });
        expect(metrics.indent).toBeCloseTo(metrics.fontSize * 2);
        expect(metrics.gap).toBeCloseTo(metrics.fontSize);
        await expect(page.locator(".markdown-preview li").first()).toHaveCSS(
          "text-indent",
          "0px",
        );
        await expect(
          page.locator(".markdown-preview p:has(img)").first(),
        ).toHaveCSS("text-indent", "0px");
        await expect(
          page.locator(".markdown-directive-center p").first(),
        ).toHaveCSS("text-indent", "0px");
      }
    });
  });

  test("comment.markdown-font-csp", async ({ page, publicFlow }) => {
    await publicFlow.run(async () => {
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
      const fontAssets = await page.evaluate(async () => {
        const sources: string[] = [];
        for (const sheet of document.styleSheets) {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSFontFaceRule) {
              const source = rule.style.getPropertyValue("src");
              for (const match of source.matchAll(
                /url\(["']?([^"')]+)["']?\)/g,
              )) {
                sources.push(
                  new URL(match[1], sheet.href ?? location.href).href,
                );
              }
            }
          }
        }
        const faces = [...document.fonts].filter((face) =>
          face.family.startsWith("KaTeX"),
        );
        await Promise.all(faces.map((face) => face.load()));
        return {
          sources,
          statuses: faces.map((face) => face.status),
          origin: location.origin,
        };
      });
      expect(fontAssets.statuses.length).toBeGreaterThan(15);
      expect(fontAssets.statuses.every((status) => status === "loaded")).toBe(
        true,
      );
      expect(fontAssets.sources.length).toBeGreaterThan(0);
      for (const source of fontAssets.sources)
        expect(new URL(source).origin).toBe(fontAssets.origin);
      expect(fontConsoleErrors).toEqual([]);
    });
  });
});
