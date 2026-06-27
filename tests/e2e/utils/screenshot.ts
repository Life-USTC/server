import type { Page, TestInfo } from "@playwright/test";

const CAPTURE_STEP_SCREENSHOTS = false;

/**
 * Captures a screenshot and attaches it to the test report.
 *
 * @param page   Playwright page
 * @param testInfo  Playwright TestInfo (for attach)
 * @param name   Screenshot name
 */
export async function captureStepScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  if (!CAPTURE_STEP_SCREENSHOTS) return;

  const screenshot = await page.screenshot({ fullPage: true });

  await testInfo.attach(name, {
    body: screenshot,
    contentType: "image/png",
  });
}

export async function capturePageScreenshot(
  page: Page,
  testInfo: TestInfo,
  options: {
    url: string;
    label?: string;
  },
) {
  const screenshot = await page.screenshot({
    fullPage: false,
    type: "jpeg",
    quality: 65,
  });

  await testInfo.attach(`screenshot:${options.url}`, {
    body: screenshot,
    contentType: "image/jpeg",
  });
}
