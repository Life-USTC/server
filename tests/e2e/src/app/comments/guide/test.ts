import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test } from "../../../../utils/public-worker";
import { assertPageContract } from "../../_shared/page-contract";

test("/community/comments/guide 重定向到标准 Markdown 指南", async ({
  page,
  publicFlow,
}) => {
  await publicFlow.run(async () => {
    await gotoAndWaitForReady(page, "/community/comments/guide", {
      waitUntil: "load",
    });
    await expect(page).toHaveURL(/\/guides\/markdown-support$/);
  });
});

test("页面契约", async ({ page, publicFlow }) => {
  await publicFlow.run(async () => {
    await assertPageContract(page, {
      routePath: "/community/comments/guide",
    });
  });
});
