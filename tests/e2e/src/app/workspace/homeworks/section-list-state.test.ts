import { expect } from "@playwright/test";
import { test } from "../../../../utils/homework-fixture";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import {
  applyWorkspaceTaskFilter,
  openWorkspaceTaskFilter,
  workspaceTaskFilterControl,
} from "../../../../utils/workspace-task-filters";

for (const locale of ["en-us", "zh-cn"] as const) {
  for (const width of [1280, 390]) {
    test(
      `homework section list preserves personal state ${locale} ${width}`,
      { tag: "@Homework/Web" },
      async (
        { page, account, academic, academicDb, homeworkRun, isolatedWorker },
        info,
      ) => {
        const completed = await academicDb((db) =>
          db.homework.create({
            data: {
              sectionId: academic.section.id,
              createdById: account.id,
              title: "Completed parity homework",
              submissionDueAt: new Date("2020-01-01T12:00:00+08:00"),
              isMajor: true,
              requiresTeam: true,
            },
          }),
        );
        await academicDb((db) =>
          db.homeworkCompletion.create({
            data: {
              homeworkId: completed.id,
              userId: account.id,
              completedAt: new Date(),
            },
          }),
        );
        await academicDb((db) =>
          db.homework.create({
            data: {
              sectionId: academic.section.id,
              createdById: account.id,
              title: "Pending parity homework",
              submissionDueAt: new Date("2020-01-01T12:00:00+08:00"),
            },
          }),
        );
        await homeworkRun(
          async () => {
            await page.context().addCookies([
              {
                name: "NEXT_LOCALE",
                value: locale,
                url: isolatedWorker.origin,
              },
            ]);

            await page.setViewportSize({ width, height: 900 });
            await gotoAndWaitForReady(page, "/workspace/homeworks");
            await openWorkspaceTaskFilter(page, "homeworks");
            await applyWorkspaceTaskFilter(
              page,
              workspaceTaskFilterControl(page, /^(全部|All)$/),
            );
            await page.keyboard.press("Escape");
            const workspace = page.getByTestId(
              width < 1280
                ? "workspace-homeworks-cards"
                : "workspace-homeworks-list",
            );
            const workspacePending = workspace
              .locator(width < 1280 ? '[data-slot="item"]' : "tbody tr")
              .filter({ hasText: "Pending parity homework" });
            const pendingReminder = await workspacePending
              .getByText(/Overdue by|已逾期/)
              .textContent();
            const workspaceCompleted = workspace
              .locator(width < 1280 ? '[data-slot="item"]' : "tbody tr")
              .filter({ hasText: completed.title });
            await expect(
              workspaceCompleted.getByText(
                locale === "en-us" ? "Completed" : "已完成",
                { exact: true },
              ),
            ).toBeVisible();
            await gotoAndWaitForReady(
              page,
              `/catalog/sections/${academic.section.jwId}#homework`,
            );
            const list = page.getByTestId("section-homeworks-list");
            await expect(
              list
                .getByRole("button", { name: completed.title, exact: true })
                .filter({ visible: true }),
            ).toBeVisible();
            await list.evaluate((element) =>
              element.scrollIntoView({ block: "center", inline: "nearest" }),
            );
            await info.attach(`homework-status-${locale}-${width}`, {
              body: await list.screenshot(),
              contentType: "image/png",
            });
            const completedRow = list
              .locator(width < 1280 ? '[data-slot="item"]' : "tbody tr")
              .filter({ hasText: completed.title });
            await expect(
              completedRow.getByText(
                locale === "en-us" ? "Completed" : "已完成",
                { exact: true },
              ),
            ).toBeVisible();
            await expect(
              completedRow.getByText(/Overdue by|已逾期/),
            ).toHaveCount(0);
            const pendingRow = list
              .locator(width < 1280 ? '[data-slot="item"]' : "tbody tr")
              .filter({ hasText: "Pending parity homework" });
            await expect(
              pendingRow.getByText(/Overdue by|已逾期/),
            ).toBeVisible();
            await expect(pendingRow.getByText(/Overdue by|已逾期/)).toHaveText(
              pendingReminder ?? "",
            );
            await expect(
              completedRow.getByRole("group", {
                name: locale === "en-us" ? "My status" : "我的状态",
                exact: true,
              }),
            ).toBeVisible();
            await completedRow
              .getByRole("button", {
                name: locale === "en-us" ? "View details" : "查看详情",
                exact: true,
              })
              .click();
            const dialog = page.getByRole("dialog", {
              name: completed.title,
              exact: true,
            });
            await dialog
              .getByRole("button", { name: /取消完成|Mark as incomplete/i })
              .click();
            await expect(
              dialog.getByRole("button", {
                name: /标记为完成|Mark as complete/i,
              }),
            ).toBeEnabled();
            await page.keyboard.press("Escape");
            await expect(
              completedRow.getByText(/Overdue by|已逾期/),
            ).toBeVisible();
            expect(
              await academicDb((db) =>
                db.homeworkCompletion.findUnique({
                  where: {
                    userId_homeworkId: {
                      userId: account.id,
                      homeworkId: completed.id,
                    },
                  },
                }),
              ),
            ).toBeNull();
            await completedRow
              .getByRole("button", {
                name: locale === "en-us" ? "View details" : "查看详情",
                exact: true,
              })
              .click();
            await page
              .getByRole("dialog", { name: completed.title, exact: true })
              .getByRole("button", { name: /标记为完成|Mark as complete/i })
              .click();
            await expect(
              page
                .getByRole("dialog", { name: completed.title, exact: true })
                .getByRole("button", { name: /取消完成|Mark as incomplete/i }),
            ).toBeEnabled();
            await page.keyboard.press("Escape");
            await expect(
              completedRow.getByText(
                locale === "en-us" ? "Completed" : "已完成",
                { exact: true },
              ),
            ).toBeVisible();
            await expect(
              completedRow.getByText(/Overdue by|已逾期/),
            ).toHaveCount(0);
          },
          {
            calendarMessages: [
              { type: "user", userId: account.id },
              { type: "user", userId: account.id },
            ],
            calendarTokenCreated: false,
          },
        );
      },
    );
  }
}
