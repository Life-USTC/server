import { expect } from "@playwright/test";
import { mobileScreenshotPaths } from "../src/app/_shared/page-inventory";
import { gotoAndWaitForReady } from "../utils/page-ready";
import {
  captureStepScreenshot,
  isStepScreenshotCaptureEnabled,
} from "../utils/screenshot";
import { test } from "../utils/personal-preferences-fixture";
import { arrangeMobilePublicState } from "../utils/mobile-public-state";
import { expectHealthyMobileRoute } from "./route-health";

test.describe("移动端页面健全性", () => {
  test.describe("公开页面", () => {
    for (const path of mobileScreenshotPaths("public")) {
      test(path, async ({ page, request, isolatedWorker, preferenceFlow }) => {
        await preferenceFlow.prepare(() =>
          arrangeMobilePublicState(
            isolatedWorker.database.owner,
            request,
            isolatedWorker.origin,
            path,
          ),
        );
        await preferenceFlow.run(async () => {
          await expectHealthyMobileRoute(page, path);
        });
      });
    }
  });

  test("命名步骤截图会写入报告附件", async ({ page, preferenceFlow }, testInfo) => {
    test.skip(
      !isStepScreenshotCaptureEnabled(),
      "Set CAPTURE_STEP_SCREENSHOTS=1 for visual evidence runs.",
    );

    await preferenceFlow.run(async () => {
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
});
