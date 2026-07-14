import type { Page, TestInfo } from "@playwright/test";

export function isStepScreenshotCaptureEnabled() {
  return process.env.CAPTURE_STEP_SCREENSHOTS === "1";
}

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
  if (!isStepScreenshotCaptureEnabled()) return;

  const screenshot = await page.screenshot({
    fullPage: true,
    type: "jpeg",
    quality: 65,
  });

  await testInfo.attach(name, {
    body: screenshot,
    contentType: "image/jpeg",
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
