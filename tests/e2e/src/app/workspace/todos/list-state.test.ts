import { expect } from "@playwright/test";
import { observeAction } from "../../../../utils/observed-action";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { captureStepScreenshot } from "../../../../utils/screenshot";
import { readTodoCalendar, test } from "../../../../utils/todo-fixture";

test.describe.configure({ mode: "parallel" });

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`待办筛选、截止时间排序和删除即时更新 ${viewport.width}`, async ({
    todoActor,
    todoRun,
    page,
    todoState,
  }, testInfo) => {
    await todoRun(
      async (effects) => {
        test.setTimeout(90_000);
        await page.setViewportSize(viewport);
        const prefix = `e2e-todo-state-${viewport.width}-${Date.now()}`;
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        const fixtures = [
          { title: `${prefix}-old`, dueAt: "2026-03-26T20:00:00+08:00" },
          { title: `${prefix}-undated`, dueAt: null },
          { title: `${prefix}-tomorrow`, dueAt: "2026-09-11T12:00:00+08:00" },
          { title: `${prefix}-near`, dueAt: "2026-09-10T13:00:00+08:00" },
        ];
        const rows = await todoState.seed(
          fixtures.map((fixture) => ({
            ...fixture,
            dueAt: fixture.dueAt ? new Date(fixture.dueAt) : null,
            priority: "medium",
          })),
        );
        await gotoAndWaitForReady(
          page,
          "/workspace/todos?snapshotAt=2026-09-10T12%3A00%3A00%2B08%3A00",
        );
        await expect(page).toHaveTitle(/待办|Todos/i);
        const list =
          viewport.width >= 768
            ? page.getByRole("table")
            : page.getByTestId("workspace-todos-cards");
        const titles = list.getByRole("button").filter({ hasText: prefix });
        await expect(titles).toHaveText([
          `${prefix}-old`,
          `${prefix}-near`,
          `${prefix}-tomorrow`,
          `${prefix}-undated`,
        ]);
        const incomplete = page.getByRole("radio", {
          name: /^(未完成|Incomplete)$/i,
        });
        const completed = page.getByRole("radio", {
          name: /^(已完成|Completed)$/i,
        });
        const all = page.getByRole("radio", { name: /^(全部|All)$/i });
        for (const filter of [
          incomplete,
          completed,
          completed,
          all,
          all,
          incomplete,
        ]) {
          await filter.click();
          await expect(filter).toBeChecked();
          await expect(titles).toHaveCount(filter === completed ? 0 : 4);
        }
        await list
          .getByRole("button", { name: `${prefix}-near`, exact: true })
          .click();
        const detail = page.getByRole("dialog", {
          name: `${prefix}-near`,
          exact: true,
        });
        await expect(detail).toBeVisible();
        const completionResponse = await observeAction(
          () =>
            page.waitForResponse(
              (response) =>
                response.request().method() === "PATCH" &&
                response.url().includes(`/api/workspace/todos/${rows[3].id}`),
            ),
          () =>
            detail
              .getByRole("button", { name: /标记为完成|Mark as complete/i })
              .click(),
        );
        expect(completionResponse.ok()).toBe(true);
        expect(completionResponse.status()).toBe(200);
        expect(await completionResponse.json()).toMatchObject({
          success: true,
          todo: { id: rows[3].id, title: `${prefix}-near`, completed: true },
        });
        expect(await todoState.read()).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: rows[3].id,
              userId: todoActor.id,
              title: `${prefix}-near`,
              content: null,
              priority: "medium",
              dueAt: new Date("2026-09-10T13:00:00+08:00"),
              completed: true,
            }),
          ]),
        );
        await effects.checkpoint("completed", {
          calendarMessages: [{ type: "user", userId: todoActor.id }],
        });
        const completedCalendar = await readTodoCalendar(page, todoActor.id);
        expect(completedCalendar.match(/BEGIN:VEVENT/g) ?? []).toHaveLength(2);
        for (const index of [0, 2])
          expect(completedCalendar).toContain(`/todo/${rows[index].id}`);
        for (const index of [1, 3])
          expect(completedCalendar).not.toContain(`/todo/${rows[index].id}`);
        await expect(detail.getByRole("heading")).toHaveCSS(
          "text-decoration-line",
          "line-through",
        );
        await captureStepScreenshot(
          page,
          testInfo,
          `todo-completed-detail-${viewport.width}`,
        );
        await detail
          .getByRole("button", { name: "Close", exact: true })
          .click();
        await expect(titles).toHaveCount(3);
        await completed.click();
        await expect(titles).toHaveText([`${prefix}-near`]);
        await titles.click();
        await detail
          .getByRole("button", { name: /删除待办|Delete todo/i })
          .click();
        const deletedResponse = await observeAction(
          () =>
            page.waitForResponse(
              (response) =>
                response.request().method() === "DELETE" &&
                response.url().includes(`/api/workspace/todos/${rows[3].id}`),
            ),
          () =>
            page
              .getByRole("alertdialog")
              .getByRole("button", { name: /^(删除|Delete)$/i })
              .click(),
        );
        expect(deletedResponse.ok()).toBe(true);
        expect(deletedResponse.status()).toBe(200);
        expect(await deletedResponse.json()).toMatchObject({
          success: true,
        });
        const remaining = await todoState.read();
        expect(remaining).toHaveLength(3);
        expect(remaining).toEqual(expect.arrayContaining(rows.slice(0, 3)));
        await effects.checkpoint("deleted", {
          calendarMessages: [
            { type: "user", userId: todoActor.id },
            { type: "user", userId: todoActor.id },
          ],
        });
        const deletedCalendar = await readTodoCalendar(page, todoActor.id);
        expect(deletedCalendar.match(/BEGIN:VEVENT/g) ?? []).toHaveLength(2);
        for (const index of [0, 2])
          expect(deletedCalendar).toContain(`/todo/${rows[index].id}`);
        for (const index of [1, 3])
          expect(deletedCalendar).not.toContain(`/todo/${rows[index].id}`);
        await expect(detail).toBeHidden();
        for (const filter of [all, incomplete, completed, all]) {
          await filter.click();
          await expect(filter).toBeChecked();
          await expect(titles).toHaveCount(filter === completed ? 0 : 3);
          await expect(
            list.getByRole("button", { name: `${prefix}-near`, exact: true }),
          ).toHaveCount(0);
        }
        await expect(titles).toHaveText([
          `${prefix}-old`,
          `${prefix}-tomorrow`,
          `${prefix}-undated`,
        ]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect(errors).toEqual([]);
        await captureStepScreenshot(
          page,
          testInfo,
          `todo-filtered-list-${viewport.width}`,
        );
      },
      {
        calendarMessages: [
          { type: "user", userId: todoActor.id },
          { type: "user", userId: todoActor.id },
        ],
      },
    );
  });
}
