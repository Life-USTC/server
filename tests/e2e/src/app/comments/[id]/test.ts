import { expect, test } from "@playwright/test";
import { signInAsDevAdmin } from "../../../../utils/auth";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { assertPageContract } from "../../_shared/page-contract";

test("/comments/[id] 页面契约", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/comments/[id]", testInfo });
});

test("/comments/[id] 无效参数返回 404", async ({ page }, testInfo) => {
  await gotoAndWaitForReady(page, "/comments/not-existing-comment-id", {
    expectMainContent: false,
  });
  await expect(page.locator("h1")).toHaveText("404");
  await captureStepScreenshot(page, testInfo, "comments-id-404");
});

test("/comments/[id] seed 评论会重定向到目标页面", async ({
  page,
}, testInfo) => {
  await signInAsDevAdmin(page, "/admin");
  const commentsResponse = await page.request.get(
    "/api/admin/comments?status=active",
  );
  expect(commentsResponse.status()).toBe(200);
  const commentsBody = (await commentsResponse.json()) as {
    comments?: Array<{ id?: string }>;
  };
  const seedComment = commentsBody.comments?.find((item) => Boolean(item.id));
  expect(seedComment?.id).toBeTruthy();

  await gotoAndWaitForReady(page, `/comments/${seedComment?.id}`, {
    expectMainContent: false,
  });
  await expect(page).toHaveURL(/\/(sections|courses|teachers)\/.+#comment-/);
  await captureStepScreenshot(page, testInfo, "comments-id-redirect");
});
