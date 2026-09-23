import { expect, test } from "@playwright/test";
import { mobileScreenshotPaths } from "../src/app/_shared/page-inventory";
import { gotoAndWaitForReady } from "../utils/page-ready";
import {
  captureStepScreenshot,
  isStepScreenshotCaptureEnabled,
} from "../utils/screenshot";
import { healthyMobileRoute } from "./route-health";

test.describe("移动端页面健全性", () => {
  test.describe("公开页面", () => {
    for (const path of mobileScreenshotPaths("public")) {
      healthyMobileRoute(path, path);
    }
  });

  test("命名步骤截图会写入报告附件", async ({ page }, testInfo) => {
    test.skip(
      !isStepScreenshotCaptureEnabled(),
      "Set CAPTURE_STEP_SCREENSHOTS=1 for visual evidence runs.",
    );

    await gotoAndWaitForReady(page, "/");
    const attachmentName = "evidence/named-checkpoint";
    await captureStepScreenshot(page, testInfo, attachmentName);

    const attachment = testInfo.attachments.find(
      (candidate) => candidate.name === attachmentName,
    );
    expect(attachment?.contentType).toBe("image/jpeg");
    expect(attachment?.body?.byteLength).toBeGreaterThan(0);
  });
});
