import { expect, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../utils/page-ready";

export function healthyMobileRoute(name: string, path: string) {
  test(name, async ({ page }) => {
    const response = await gotoAndWaitForReady(page, path, {
      browserHealth: {},
      expectMeaningfulContent: true,
      expectNoHorizontalOverflow: true,
      uiQuality: {},
    });

    expect(
      response,
      `Expected ${path} to return a document response`,
    ).not.toBeNull();
    expect(
      response?.ok(),
      `Expected ${path} to return a successful status`,
    ).toBe(true);
    expect(
      (await page.title()).trim(),
      `Expected ${path} to have a page title`,
    ).not.toBe("");
  });
}
