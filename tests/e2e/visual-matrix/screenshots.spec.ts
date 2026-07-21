import { expect, test } from "@playwright/test";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../utils/page-ready";
import { absoluteTestUrl } from "../utils/request-url";
import { captureStepScreenshot } from "../utils/screenshot";

const UI_MATRIX_LOCALES = ["zh-cn", "en-us"] as const;
const UI_MATRIX_THEMES = ["light", "dark", "system"] as const;

test.describe("语言、主题和视口矩阵", () => {
  for (const locale of UI_MATRIX_LOCALES) {
    for (const theme of UI_MATRIX_THEMES) {
      test(`${locale} / ${theme}`, async ({ baseURL, page }, testInfo) => {
        await page.emulateMedia({
          colorScheme: theme === "light" ? "light" : "dark",
        });
        await page.context().addCookies([
          {
            name: "NEXT_LOCALE",
            value: locale,
            url: absoluteTestUrl("/", baseURL),
            sameSite: "Lax",
          },
        ]);
        await page.addInitScript((themeMode) => {
          localStorage.setItem("life-ustc-theme", themeMode);
        }, theme);

        await gotoAndWaitForReady(page, "/");

        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute(
          "data-theme",
          theme === "light" ? "light" : "dark",
        );
        await expect(
          page.getByRole("heading", {
            level: 1,
            name:
              locale === "zh-cn"
                ? "先从公开校园工具开始"
                : "Start with public campus tools",
          }),
        ).toBeVisible();
        await expectNoPageHorizontalOverflow(page);
        await captureStepScreenshot(
          page,
          testInfo,
          `visual-matrix/${testInfo.project.name}-${locale}-${theme}`,
        );
      });
    }
  }
});
