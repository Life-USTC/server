import { expect } from "@playwright/test";
import { test } from "../../../utils/catalog-browser-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

for (const locale of ["zh-cn", "en-us"] as const) {
  test(
    `empty copy respects signed-in comments and exam scope ${locale}`,
    {
      tag: ["@Comment/Web", "@Exam/Web"],
    },
    async ({ page, isolatedWorker, community, communityFlow }, testInfo) => {
      await communityFlow.run(async () => {
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        const section = await community.db.section.findFirstOrThrow({
          where: { courseId: community.course.id },
        });
        const group = await community.db.scheduleGroup.create({
          data: {
            jwId: 1800000000,
            no: 1,
            limitCount: 1,
            stdCount: 1,
            actualPeriods: 2,
            isDefault: true,
            sectionId: section.id,
          },
        });
        await community.db.schedule.create({
          data: {
            periods: 2,
            date: new Date("2026-11-06T00:00:00Z"),
            weekday: 5,
            startTime: 945,
            endTime: 1210,
            weekIndex: 10,
            startUnit: 3,
            endUnit: 4,
            sectionId: section.id,
            scheduleGroupId: group.id,
          },
        });
        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await gotoAndWaitForReady(page, `/catalog/sections/${section.jwId}`);
          const comments = page.locator("#comments");
          await comments.scrollIntoViewIfNeeded();
          await expect(
            comments.getByRole("button", { name: /发布评论|Post comment/ }),
          ).toBeVisible();
          await expect(
            comments.getByText(
              locale === "zh-cn" ? "暂无评论" : "No comments yet",
              { exact: true },
            ),
          ).toBeVisible();
          await testInfo.attach(`comments-${locale}-${width}`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: "image/png",
          });
          await expect
            .soft(comments)
            .toContainText(
              locale === "zh-cn"
                ? "还没有评论，分享你的体验与建议。"
                : "No comments yet. Share your experience and suggestions.",
            );
          await expect
            .soft(comments)
            .not.toContainText(
              locale === "zh-cn" ? "登录后即可" : "Sign in to share",
            );
          const exams = page.locator("#exams");
          await exams.scrollIntoViewIfNeeded();
          await expect
            .soft(exams)
            .toContainText(
              locale === "zh-cn"
                ? "暂无可用考试安排"
                : "No exam arrangements available yet",
            );
          await expect
            .soft(exams)
            .not.toContainText(
              locale === "zh-cn" ? "暂无课程" : "classes or exams",
            );
        }
        expect(await community.db.comment.count()).toBe(0);
        expect(await community.db.schedule.count()).toBe(1);
        expect(await community.db.exam.count()).toBe(0);
      });
    },
  );
}

for (const locale of ["zh-cn", "en-us"] as const) {
  test(
    `organizer detail copy describes its own activities ${locale}`,
    { tag: "@Young/Web" },
    async ({ page, isolatedWorker, catalogFlow }, testInfo) => {
      await catalogFlow.run(async () => {
        const organizer =
          await isolatedWorker.database.owner.youngOrganizer.create({
            data: {
              name: "Empty organizer",
              normalizedName: "empty-organizer",
            },
          });
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await gotoAndWaitForReady(
            page,
            `/catalog/young-events/organizers/${organizer.id}`,
          );
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            "Empty organizer",
          );
          await testInfo.attach(`organizer-${locale}-${width}`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: "image/png",
          });
          await expect
            .soft(page.locator("#main-content"))
            .toContainText(
              locale === "zh-cn"
                ? "查看该主办方发布的活动与历史记录。"
                : "Browse activities and history from this organizer.",
            );
          await expect
            .soft(page.locator("#main-content"))
            .not.toContainText(
              locale === "zh-cn" ? "按名称查找" : "search by name",
            );
        }
      });
    },
  );
}

for (const locale of ["zh-cn", "en-us"] as const) {
  test(`comment empty copy preserves anonymous guidance ${locale}`, {
    tag: "@Comment/Web",
  }, async ({ page, isolatedWorker, community, catalogFlow }) => {
    await catalogFlow.run(
      async () => {
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        await gotoAndWaitForReady(
          page,
          `/catalog/courses/${community.course.jwId}#comments`,
        );
        const comments = page.locator("#comments");
        await comments.scrollIntoViewIfNeeded();
        await expect(comments).toContainText(
          locale === "zh-cn"
            ? "登录后即可分享体验与建议。"
            : "Sign in to share your experience and tips.",
        );
        await expect(comments).not.toContainText(
          locale === "zh-cn"
            ? "还没有评论，分享你的体验与建议。"
            : "No comments yet. Share your experience and suggestions.",
        );
        expect(await community.db.comment.count()).toBe(0);
      },
      { anonymousCourseCount: 1 },
    );
  });
  test(`comment empty copy preserves suspended guidance ${locale}`, {
    tag: "@Comment/Web",
  }, async ({ page, isolatedWorker, community, account, communityFlow }) => {
    await community.db.userSuspension.create({
      data: { userId: account.id, reason: "Test suspension" },
    });
    await communityFlow.run(async () => {
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
        ]);
      await gotoAndWaitForReady(
        page,
        `/catalog/courses/${community.course.jwId}#comments`,
      );
      const comments = page.locator("#comments");
      await comments.scrollIntoViewIfNeeded();
      await expect(
        comments.locator("[data-slot=empty-description]"),
      ).toHaveText(
        locale === "zh-cn"
          ? "你的账号已被封禁，无法发布评论。"
          : "Your account has been suspended and cannot post comments.",
      );
      await expect(comments).not.toContainText(
        locale === "zh-cn"
          ? "还没有评论，分享你的体验与建议。"
          : "No comments yet. Share your experience and suggestions.",
      );
      expect(await community.db.comment.count()).toBe(0);
    });
  });
}
