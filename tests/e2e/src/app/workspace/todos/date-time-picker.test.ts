import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test } from "../../../../utils/todo-fixture";

for (const [locale, width] of [
  ["zh-cn", 1280],
  ["en-us", 1280],
  ["zh-cn", 390],
  ["en-us", 390],
] as const) {
  test(
    `todo.date-time-input ${locale}/${width}`,
    { tag: "@Todo/Web" },
    async ({ page, todoRun, todoState, isolatedWorker }, info) => {
      await todoRun(
        async () => {
          await page.context().addCookies([
            {
              name: "NEXT_LOCALE",
              value: locale,
              url: isolatedWorker.origin,
            },
          ]);
          await page.setViewportSize({ width, height: 900 });
          await gotoAndWaitForReady(page, "/workspace/todos");
          await page
            .getByRole("button", { name: /添加待办|Add Todo/i })
            .first()
            .click();
          const dialog = page.getByRole("dialog", {
            name: /新建待办|New Todo/,
          });
          const due = dialog.locator('input[name="dueAt"]');
          await due.fill("2026-11-05T23:59");
          await dialog
            .getByRole("button", {
              name: /选择日期|Choose date|日历|calendar/i,
            })
            .click();
          await info.attach(`datetime-${locale}-${width}`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: "image/png",
          });
          const time = page.locator('input[type="time"]');
          await expect(time).toBeVisible();
          await expect(
            page.getByRole("button", {
              name: locale === "zh-cn" ? "上个月" : "Previous month",
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            page.getByRole("button", {
              name: locale === "zh-cn" ? "下个月" : "Next month",
              exact: true,
            }),
          ).toBeVisible();
          await expect(time).toHaveAccessibleName(
            locale === "zh-cn" ? "时间" : "Time",
          );
          await time.fill("14:30");
          await expect(due).toHaveValue("2026-11-05T14:30");
          const calendar = page.getByRole("grid");
          await expect(calendar).toBeVisible();
          await calendar
            .getByRole("button", {
              name: locale === "zh-cn" ? /2026年11月6/ : /November 6, 2026/,
            })
            .click();
          await expect(due).toHaveValue("2026-11-06T14:30");
          await page.keyboard.press("Escape");
          await expect(due).toBeVisible();
          await due.fill("");
          await expect(due).toHaveValue("");
          await dialog.getByRole("button", { name: /取消|Cancel/ }).click();
          expect(await todoState.read()).toEqual([]);
        },
        { calendarMessages: [] },
      );
    },
  );
}
