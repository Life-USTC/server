import { expect, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";

test("/comments/guide 重定向到标准 Markdown 指南", async ({ page }) => {
  await gotoAndWaitForReady(page, "/comments/guide", {
    waitUntil: "load",
  });
  await expect(page).toHaveURL(/\/guides\/markdown-support$/);
});
