import { mobilePageCases } from "../src/app/_shared/page-inventory";
import { test } from "../utils/mobile-page-fixture";
import { expectHealthyMobileRoute } from "./route-health";

test.describe("移动端页面健全性", () => {
  test.describe("管理员页面", () => {
    test.use({ mobileRole: "admin" });

    test("administrator management pages share a private session", {
      tag: "@Admin/Web",
    }, async ({ page, mobileRun }) => {
      await mobileRun(
        async ({ startPage, checkpoint }) => {
          await startPage();
          for (const { path } of mobilePageCases("admin")) {
            await test.step(path, async () => {
              await expectHealthyMobileRoute(page, path);
              await checkpoint(path, {
                calendarMessages: [],
                calendarTokenCreated: false,
              });
            });
          }
        },
        { calendarTokenCreated: false },
      );
    });
  });
});
