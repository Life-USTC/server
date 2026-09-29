import { expect } from "@playwright/test";
import { test } from "../../../../utils/homework-fixture";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";

test.describe("仪表盘作业", () => {
  test.describe.configure({ mode: "parallel" });

  test("可切换作业完成状态", async ({
    page,
    account,
    homeworks,
    homeworkRun,
    storedHomeworkCompletion,
  }, testInfo) => {
    await homeworkRun(
      async () => {
        test.setTimeout(60_000);
        await gotoAndWaitForReady(page, "/workspace/homeworks", {
          testInfo,
          screenshotLabel: "homeworks",
        });

        expect(
          await storedHomeworkCompletion(account.id, homeworks[0].id),
        ).toBeNull();

        // Switch to "all" filter
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

        const before =
          (await completionButton.getAttribute("aria-label"))?.trim() ?? "";

        const completionResponse = page.waitForResponse(
          (r) =>
            r.url().includes("/api/workspace/homeworks/") &&
            r.url().includes("/completion") &&
            r.status() === 200,
        );
        await completionButton.click();
        await completionResponse;
        await expect(completionButton).not.toHaveAttribute(
          "aria-label",
          before,
          {
            timeout: 15_000,
          },
        );

        expect(
          await storedHomeworkCompletion(account.id, homeworks[0].id),
        ).toMatchObject({ userId: account.id, homeworkId: homeworks[0].id });
        expect(
          await storedHomeworkCompletion(account.id, homeworks[1].id),
        ).toBeNull();
        const after =
          (await completionButton.getAttribute("aria-label"))?.trim() ?? "";
        expect(after).not.toBe(before);
        await captureStepScreenshot(
          page,
          testInfo,
          "homeworks/completion-toggled",
        );

        // Clearing completion is a second UI transition on the same owned homework.
        const restoreResponse = page.waitForResponse(
          (r) =>
            r.url().includes("/api/workspace/homeworks/") &&
            r.url().includes("/completion") &&
            r.status() === 200,
        );
        await completionButton.click();
        await restoreResponse;
        expect(
          await storedHomeworkCompletion(account.id, homeworks[0].id),
        ).toBeNull();
        await expect(completionButton).toHaveAttribute("aria-label", before);
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

  test("完成状态更新失败显示本地化仪表盘错误", async ({
    page,
    account,
    homeworks,
    homeworkRun,
    storedHomeworkCompletion,
  }, testInfo) => {
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
        await gotoAndWaitForReady(page, "/workspace/homeworks", {
          testInfo,
          screenshotLabel: "homeworks",
        });

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

        const completionResponse = page.waitForResponse(
          (r) =>
            r.url().includes("/api/workspace/homeworks/") &&
            r.url().includes("/completion") &&
            r.status() === 500,
        );
        await completionButton.click();
        await completionResponse;

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
        await captureStepScreenshot(
          page,
          testInfo,
          "homeworks/completion-error",
        );
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  });
});
