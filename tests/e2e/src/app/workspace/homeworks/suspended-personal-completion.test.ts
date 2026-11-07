import { expect } from "@playwright/test";
import { test } from "../../../../utils/homework-fixture";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";

for (const suspended of [false, true]) {
  for (const width of [1280, 390]) {
    test(`${suspended ? "suspended" : "active"} owner completes and reopens homework across entrances ${width}`, {
      tag: "@Homework/Web",
    }, async ({
      page,
      account,
      academic,
      academicDb,
      homeworks,
      homeworkRun,
    }) => {
      const homework = homeworks[0];
      const foreign = await academicDb(async (db) => {
        const other = await db.user.create({
          data: {
            id: crypto.randomUUID(),
            name: "Other owner",
            email: `${crypto.randomUUID()}@example.test`,
          },
        });
        if (suspended)
          await db.userSuspension.create({
            data: { userId: account.id, reason: "Isolated suspended owner" },
          });
        return db.homeworkCompletion.create({
          data: { userId: other.id, homeworkId: homework.id },
        });
      });
      await homeworkRun(
        async () => {
          await page.setViewportSize({ width, height: 900 });
          await gotoAndWaitForReady(page, "/workspace/homeworks");
          if (suspended)
            await expect(
              page.getByTestId("workspace-homeworks-add"),
            ).toBeDisabled();
          else
            await expect(
              page.getByTestId("workspace-homeworks-add"),
            ).toBeEnabled();
          await page
            .getByRole("button", { name: homework.title, exact: true })
            .filter({ visible: true })
            .click();
          let dialog = page.getByRole("dialog", {
            name: homework.title,
            exact: true,
          });
          await dialog
            .getByRole("button", { name: /标记为完成|Mark as complete/ })
            .click();
          await expect(
            dialog.getByRole("button", { name: /取消完成|Mark as incomplete/ }),
          ).toBeEnabled();
          const fullDetails = dialog.getByRole("link", {
            name: /打开完整详情|Open full details/,
          });
          const href = await fullDetails.getAttribute("href");
          const target = new URL(href ?? "", "https://example.test");
          expect(target.pathname).toBe(
            `/catalog/sections/${academic.section.jwId}`,
          );
          expect(target.searchParams.get("homeworkId")).toBe(homework.id);
          await fullDetails.click();
          dialog = page.getByRole("dialog", {
            name: homework.title,
            exact: true,
          });
          const contextActions = dialog.getByRole("button", {
            name: /更多信息|More details/,
          });
          if (suspended) await expect(contextActions).toHaveCount(0);
          else {
            await expect(contextActions).toBeEnabled();
            await contextActions.click();
            await expect(
              page.getByRole("menuitem", { name: /编辑信息|Edit details/ }),
            ).toBeVisible();
            await page.keyboard.press("Escape");
          }
          await dialog
            .getByRole("button", { name: /取消完成|Mark as incomplete/ })
            .click();
          await expect(
            dialog.getByRole("button", { name: /标记为完成|Mark as complete/ }),
          ).toBeEnabled();
          expect(
            await academicDb((db) =>
              db.homeworkCompletion.findUnique({
                where: {
                  userId_homeworkId: {
                    userId: foreign.userId,
                    homeworkId: foreign.homeworkId,
                  },
                },
              }),
            ),
          ).toEqual(foreign);
          expect(
            await academicDb((db) =>
              db.homeworkCompletion.count({
                where: { userId: account.id, homeworkId: homework.id },
              }),
            ),
          ).toBe(0);
        },
        {
          calendarMessages: [
            { type: "user", userId: account.id },
            { type: "user", userId: account.id },
          ],
          calendarTokenCreated: false,
        },
      );
    });
  }
}
