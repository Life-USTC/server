import { expect } from "@playwright/test";
import { test } from "../../../../utils/homework-fixture";
import { observeAction } from "../../../../utils/observed-action";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";

test.describe("仪表盘作业", () => {
  test.describe.configure({ mode: "parallel" });

  for (const initiallyCompleted of [false, true]) {
    const name = initiallyCompleted
      ? "可取消已准备作业的完成状态"
      : "可切换作业完成状态";
    test(name, { tag: "@Homework/Web" }, async ({
      page,
      account,
      homeworks,
      academicDb,
      homeworkRun,
      storedHomeworkCompletion,
    }) => {
      if (initiallyCompleted)
        await academicDb((db) =>
          db.homeworkCompletion.create({
            data: {
              userId: account.id,
              homeworkId: homeworks[0].id,
              completedAt: new Date("2026-01-01T00:00:00Z"),
            },
          }),
        );
      await homeworkRun(
        async () => {
          test.setTimeout(60_000);
          await gotoAndWaitForReady(page, "/workspace/homeworks");
          const before = await storedHomeworkCompletion(
            account.id,
            homeworks[0].id,
          );
          if (initiallyCompleted)
            expect(before).toMatchObject({
              userId: account.id,
              homeworkId: homeworks[0].id,
            });
          else expect(before).toBeNull();
          await page
            .getByRole("radio", { name: /全部|All/i })
            .first()
            .click();
          await expect(page.getByRole("switch")).toHaveCount(0);
          const row = page
            .getByRole("row")
            .filter({ hasText: homeworks[0].title })
            .first();
          await expect(row).toBeVisible();
          const completionButton = row
            .getByRole("button", {
              name: /标记为完成|取消完成|Mark as complete|Mark as incomplete/i,
            })
            .first();
          await expect(completionButton).toBeVisible();
          await expect(completionButton).toHaveAttribute(
            "aria-label",
            initiallyCompleted
              ? /取消完成|Mark as incomplete/i
              : /标记为完成|Mark as complete/i,
          );
          await observeAction(
            () =>
              page.waitForResponse(
                (r) =>
                  r.url().includes("/api/workspace/homeworks/") &&
                  r.url().includes("/completion") &&
                  r.status() === 200,
              ),
            async () => {
              await completionButton.click();
            },
          );
          await expect(completionButton).toHaveAttribute(
            "aria-label",
            initiallyCompleted
              ? /标记为完成|Mark as complete/i
              : /取消完成|Mark as incomplete/i,
            initiallyCompleted ? undefined : { timeout: 15_000 },
          );
          const after = await storedHomeworkCompletion(
            account.id,
            homeworks[0].id,
          );
          if (initiallyCompleted) expect(after).toBeNull();
          else
            expect(after).toMatchObject({
              userId: account.id,
              homeworkId: homeworks[0].id,
            });
          expect(
            await storedHomeworkCompletion(account.id, homeworks[1].id),
          ).toBeNull();
        },
        {
          calendarMessages: [{ type: "user", userId: account.id }],
          calendarTokenCreated: false,
        },
      );
    });
  }

  test("完成状态更新失败显示本地化仪表盘错误", {
    tag: "@Homework/Web",
  }, async ({
    page,
    account,
    homeworks,
    homeworkRun,
    storedHomeworkCompletion,
  }) => {
    await homeworkRun(
      async () => {
        await page.route(
          /\/api\/workspace\/homeworks\/[^/]+\/completion$/,
          async (route) => {
            await route.fulfill({
              body: JSON.stringify({ error: { message: "forced failure" } }),
              contentType: "application/json",
              status: 500,
            });
          },
        );
        await gotoAndWaitForReady(page, "/workspace/homeworks");

        await page
          .getByRole("radio", { name: /全部|All/i })
          .first()
          .click();

        const row = page
          .getByRole("row")
          .filter({ hasText: homeworks[0].title })
          .first();
        await expect(row).toBeVisible();

        const completionButton = row
          .getByRole("button", {
            name: /标记为完成|取消完成|Mark as complete|Mark as incomplete/i,
          })
          .first();
        await expect(completionButton).toBeVisible();

        await observeAction(
          () =>
            page.waitForResponse(
              (r) =>
                r.url().includes("/api/workspace/homeworks/") &&
                r.url().includes("/completion") &&
                r.status() === 500,
            ),
          async () => {
            await completionButton.click();
          },
        );

        await expect(
          page.getByText(/更新完成状态失败|Couldn't update completion/i),
        ).toBeVisible();
        expect(
          await storedHomeworkCompletion(account.id, homeworks[0].id),
        ).toBeNull();
        await expect(completionButton).toHaveAccessibleName(
          /标记为完成|Mark as complete/i,
        );
        await gotoAndWaitForReady(page, "/workspace/homeworks");
        await expect(
          page
            .getByRole("row")
            .filter({ hasText: homeworks[0].title })
            .getByRole("button", { name: /标记为完成|Mark as complete/i }),
        ).toBeVisible();
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  });
});
