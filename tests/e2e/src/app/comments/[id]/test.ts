import { expect } from "@playwright/test";
import { discussion, test } from "../../../../utils/community-fixture";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test as publicTest } from "../../../../utils/public-worker";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe.configure({ mode: "parallel" });

test("/community/comments/[id] 页面契约", async ({
  communityFlow,
  page,
  comment,
  community,
}, testInfo) => {
  await communityFlow.run(async () => {
    const response = await gotoAndWaitForReady(
      page,
      `/community/comments/${comment.id}`,
      {
        browserHealth: {},
        expectMeaningfulContent: true,
        expectNoHorizontalOverflow: true,
        uiQuality: {},
        testInfo,
        screenshotLabel: "comments-id",
      },
    );
    expect(response?.ok()).toBe(true);
    expect(new URL(page.url()).pathname).toBe(
      `/catalog/sections/${community.section.jwId}`,
    );
    expect(new URL(page.url()).hash).toBe(`#comment-${comment.id}`);
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator(`#comment-${comment.id}`)).toContainText(
      discussion,
    );
  }, {});
});

publicTest(
  "/community/comments/[id] 无效参数返回 404",
  async ({ publicFlow, page }, testInfo) => {
    await publicFlow.run(async () => {
      await gotoAndWaitForReady(
        page,
        "/community/comments/not-existing-comment-id",
        { expectMainContent: false },
      );
      await expect(page.locator("h1")).toHaveText("404");
      await captureStepScreenshot(page, testInfo, "comments-id-404");
    }, {});
  },
);

test("/community/comments/[id] 公开评论为匿名读者重定向到目标页面", async ({
  communityFlow,
  page,
  comment,
  community,
}, testInfo) => {
  await communityFlow.run(async () => {
    await page.context().clearCookies();
    await gotoAndWaitForReady(page, `/community/comments/${comment.id}`, {
      expectMainContent: false,
    });
    expect(new URL(page.url()).pathname).toBe(
      `/catalog/sections/${community.section.jwId}`,
    );
    expect(new URL(page.url()).hash).toBe(`#comment-${comment.id}`);
    await expect(page.locator(`#comment-${comment.id}`)).toContainText(
      discussion,
    );
    await captureStepScreenshot(page, testInfo, "comments-id-redirect");
  }, {});
});

test("/community/comments/[id] 按目标解析到对应详情页锚点", async ({
  communityFlow,
  page,
  account,
  community,
}) => {
  await communityFlow.run(async () => {
    // Known state: one comment per catalog target, seeded directly. The
    // canonical address differs per target, so each one is read on its own
    // detail page instead of through a create flow.
    const seeded = await community.db.$transaction((tx) =>
      Promise.all(
        community.targets.map(async (target) => {
          const relation = { [`${target.type}Id`]: target.id };
          const body = `${discussion} ${target.type}`;
          return {
            body,
            target,
            row: await tx.comment.create({
              data: { ...relation, userId: account.id, body },
            }),
          };
        }),
      ),
    );
    for (const { body, target, row } of seeded) {
      await gotoAndWaitForReady(page, `/community/comments/${row.id}`);
      expect(new URL(page.url()).pathname).toBe(target.path);
      expect(new URL(page.url()).hash).toBe(`#comment-${row.id}`);
      await expect(page.locator(`#comment-${row.id}`)).toContainText(body);
    }
  }, {});
});
