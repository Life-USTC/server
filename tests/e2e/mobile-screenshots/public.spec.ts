import { mobileScreenshotPaths } from "../src/app/_shared/page-inventory";
import { arrangeMobilePublicState } from "../utils/mobile-public-state";
import { test } from "../utils/personal-preferences-fixture";
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
});
