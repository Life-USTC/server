import { expect, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { assertPageContract } from "../../_shared/page-contract";

test("/community/comments/guide 重定向到标准 Markdown 指南", async ({
  page,
}) => {
  await gotoAndWaitForReady(page, "/community/comments/guide", {
    waitUntil: "load",
  });
  await expect(page).toHaveURL(/\/guides\/markdown-support$/);
});

test("页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, {
    routePath: "/community/comments/guide",
    testInfo,
  });
});
