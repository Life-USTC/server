import { mobileScreenshotPaths } from "../src/app/_shared/page-inventory";
import { expectHealthyMobileRoute, test } from "../utils/mobile-page-fixture";

test.describe("移动端页面健全性", () => {
  test.describe("管理员页面", () => {
    test.use({ mobileRole: "admin" });

    for (const path of mobileScreenshotPaths("admin")) {
      test(path, async ({ page, mobileRun }) => {
        await mobileRun(async () => expectHealthyMobileRoute(page, path), {
          calendarTokenCreated: false,
        });
      });
    }
  });
});
