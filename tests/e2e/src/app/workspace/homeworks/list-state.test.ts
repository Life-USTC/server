import { expect, type Locator, test } from "@playwright/test";
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

  test("homework.completed-deadline-display", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const reminder = /已逾期|还剩|Overdue by|left/i;
    function locators(target: Locator, detail: boolean) {
      const status = detail
        ? target
            .getByTestId("homework-secondary-details")
            .getByRole("row")
            .filter({ hasText: /状态|Status/i })
            .getByRole("cell")
            .first()
        : target.getByText(/^(已完成|Completed)$/i);
      return {
        due_at: (detail
          ? target.getByTestId("homework-deadline-summary")
          : target
        )
          .getByText(/\d{1,2}:\d{2}/)
          .first(),
        completion: status,
        major: detail
          ? status.filter({ hasText: /大作业|Major/i })
          : target.getByText(/大作业|Major/i, { exact: true }),
        team: detail
          ? status.filter({ hasText: /需要组队|Team required|Requires team/i })
          : target.getByText(/需要组队|Team required|Requires team/i, {
              exact: true,
            }),
        deadline_reminder: target.getByText(reminder),
      };
    }
    async function assertCompleted(target: Locator, detail: boolean) {
      const fields = locators(target, detail);
      for (const field of ["due_at", "completion", "major", "team"] as const)
        await expect(fields[field]).toBeVisible();
      await expect(fields.deadline_reminder).toHaveCount(0);
      await expect(fields.completion).toContainText(/已完成|Completed/i);
    }
    await signInAsDebugUser(page, "/workspace/homeworks");
    await ensureSeedSectionSubscription(page);
    for (const target of ["workspace-list", "workspace-card"] as const) {
      const mobile = target === "workspace-card";
      await page.setViewportSize(
        mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      );
      for (const overdue of [true, false]) {
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
          homeworkId = (await response.json()).id;
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
          await expect(
            locators(surface, false).deadline_reminder,
          ).toBeVisible();
          const dueText = await locators(surface, false).due_at.textContent();
          await surface
            .getByRole("button", {
              name: /标记为完成|Mark as complete/i,
            })
            .click();
          await expect(
            surface.getByRole("button", {
              name: /取消完成|Mark as incomplete/i,
            }),
          ).toBeEnabled();
          await assertCompleted(surface, false);

          await expect(locators(surface, false).due_at).toHaveText(
            dueText ?? "",
          );
          await captureStepScreenshot(
            page,
            testInfo,
            `homeworks/completed-deadline-${mobile}-${overdue}`,
          );
          {
            await surface
              .getByRole("button", { name: title, exact: true })
              .click();
            const dialog = page.getByRole("dialog");
            await assertCompleted(dialog, true);

            await dialog
              .getByRole("button", { name: /取消完成|Mark as incomplete/i })
              .click();
            await expect(
              locators(dialog, true).deadline_reminder,
            ).toBeVisible();
            await page.keyboard.press("Escape");
          }
          await expect(
            locators(surface, false).deadline_reminder,
          ).toBeVisible();
        } finally {
          await cleanupHomeworksForE2e([homeworkId]);
        }
      }
    }
  });
});
