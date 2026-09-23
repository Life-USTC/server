import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { cleanupHomeworksForE2e } from "../../../../utils/homeworks";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { ensureSeedSectionSubscription } from "../../../../utils/subscriptions";

test.describe("仪表盘作业", () => {
  test.describe.configure({ mode: "serial" });

  test("桌面端默认显示作业列表", async ({ page }, testInfo) => {
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    await gotoAndWaitForReady(page, "/workspace/homeworks", {
      testInfo,
      screenshotLabel: "homeworks",
    });

    await page
      .getByRole("radio", { name: /全部|All/i })
      .first()
      .click();

    await expect(
      page.getByRole("radio", { name: /列表|List|卡片|Cards/i }),
    ).toHaveCount(0);
    await expect(page.getByTestId("workspace-homeworks-list")).toBeVisible();
    await expect(page.getByTestId("workspace-homeworks-cards")).toBeHidden();
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: DEV_SEED.homeworks.title })
        .first(),
    ).toBeVisible();

    await captureStepScreenshot(page, testInfo, "homeworks/list-view");
  });

  for (const mobile of [false, true]) {
    for (const overdue of [true, false]) {
      test(`已完成作业隐藏截止提醒：${mobile ? "移动卡片" : "桌面列表"} / ${overdue ? "逾期" : "未到期"}`, async ({
        page,
      }, testInfo) => {
        test.setTimeout(90_000);
        await page.setViewportSize(
          mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
        );
        await signInAsDebugUser(page, "/workspace/homeworks");
        await ensureSeedSectionSubscription(page);
        const title = `e2e-completed-deadline-${mobile}-${overdue}`;
        let homeworkId: string | undefined;
        try {
          const response = await page.request.post(
            "/api/community/section-homeworks",
            {
              data: {
                sectionJwId: DEV_SEED.section.jwId,
                title,
                submissionDueAt: overdue
                  ? "2020-01-01T12:00:00+08:00"
                  : "2099-01-01T12:00:00+08:00",
                isMajor: true,
                requiresTeam: true,
              },
            },
          );
          expect(response.ok()).toBe(true);
          const created = await response.json();
          homeworkId = created.id;
          expect(homeworkId).toBeTruthy();
          await gotoAndWaitForReady(page, "/workspace/homeworks");
          await page
            .getByRole("radio", { name: /全部|All/i })
            .first()
            .click();
          const surface = mobile
            ? page
                .getByTestId("workspace-homeworks-cards")
                .locator('[data-slot="item"]')
                .filter({ hasText: title })
            : page.getByRole("row").filter({ hasText: title });
          const reminder = /已逾期|还剩|Overdue by|left/i;
          const reminderText = surface.getByText(reminder);
          await expect(reminderText).toBeVisible();
          const dueText = await surface
            .getByText(/\d{1,2}:\d{2}/)
            .first()
            .textContent();
          const complete = surface.getByRole("button", {
            name: /标记为完成|Mark as complete/i,
          });
          await complete.click();
          await expect(
            surface.getByRole("button", {
              name: /取消完成|Mark as incomplete/i,
            }),
          ).toBeEnabled();
          await expect(reminderText).toHaveCount(0);
          await expect(
            surface.getByText(/^(已完成|Completed)$/i),
          ).toBeVisible();
          await expect(
            surface.getByText(/大作业|Major/i, { exact: true }),
          ).toBeVisible();
          await expect(
            surface.getByText(/需要组队|Team required|Requires team/i, {
              exact: true,
            }),
          ).toBeVisible();
          expect(
            await surface
              .getByText(/\d{1,2}:\d{2}/)
              .first()
              .textContent(),
          ).toBe(dueText);
          await captureStepScreenshot(
            page,
            testInfo,
            `homeworks/completed-deadline-${mobile}-${overdue}`,
          );

          await surface
            .getByRole("button", { name: title, exact: true })
            .click();
          const dialog = page.getByRole("dialog");
          const summary = dialog.getByTestId("homework-deadline-summary");
          await expect(summary.getByText(reminder)).toHaveCount(0);
          // The single-column popup keeps the due block for due facts only;
          // completion status is the first value in the facts table.
          const statusCell = dialog
            .getByTestId("homework-secondary-details")
            .getByRole("row")
            .filter({ hasText: /状态|Status/i })
            .getByRole("cell")
            .first();
          await expect(statusCell).toHaveText(/^(已完成|Completed)/i);
          await expect(summary.getByText(/\d{1,2}:\d{2}/)).toBeVisible();
          await dialog
            .getByRole("button", { name: /取消完成|Mark as incomplete/i })
            .click();
          await expect(summary.getByText(reminder)).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(reminderText).toBeVisible();
        } finally {
          await cleanupHomeworksForE2e([homeworkId]);
        }
      });
    }
  }
});
