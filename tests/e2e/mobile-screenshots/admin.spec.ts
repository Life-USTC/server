import { test } from "@playwright/test";
import { mobileScreenshotPaths } from "../src/app/_shared/page-inventory";
import { signInAsDevAdmin } from "../utils/auth";
import { healthyMobileRoute } from "./route-health";

test.describe("移动端页面健全性", () => {
  test.describe("管理员页面", () => {
    test.beforeEach(async ({ page }) => {
      await signInAsDevAdmin(page, "/admin/users");
    });

    for (const path of mobileScreenshotPaths("admin")) {
      healthyMobileRoute(path, path);
    }
  });
});
