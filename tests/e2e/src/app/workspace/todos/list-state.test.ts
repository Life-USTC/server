import { expect } from "@playwright/test";
import { observeAction } from "../../../../utils/observed-action";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { readTodoCalendar, test } from "../../../../utils/todo-fixture";

test.describe.configure({ mode: "parallel" });

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  for (const action of ["complete", "delete"] as const) {
    test(`todo ${action} updates filters and calendar ${viewport.width}`, {
      tag: "@Todo/Web",
    }, async ({ todoActor, todoRun, page, todoState }) => {
      await todoRun(
        async (effects) => {
          test.setTimeout(90_000);
          await page.setViewportSize(viewport);
          const prefix = `e2e-todo-state-${viewport.width}`;
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
            fixtures.map((fixture, index) => ({
              ...fixture,
              dueAt: fixture.dueAt ? new Date(fixture.dueAt) : null,
              priority: "medium",
              completed: action === "delete" && index === 3,
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
            ...(action === "complete" ? [`${prefix}-near`] : []),
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
            await expect(titles).toHaveCount(
              filter === completed
                ? action === "delete"
                  ? 1
                  : 0
                : filter === all
                  ? 4
                  : action === "delete"
                    ? 3
                    : 4,
            );
          }
          if (action === "delete") await completed.click();
          await list
            .getByRole("button", { name: `${prefix}-near`, exact: true })
            .click();
          const detail = page.getByRole("dialog", {
            name: `${prefix}-near`,
            exact: true,
          });
          await expect(detail).toBeVisible();
          if (action === "delete")
            await detail
              .getByRole("button", { name: /删除待办|Delete todo/i })
              .click();
          const response = await observeAction(
            () =>
              page.waitForResponse(
                (response) =>
                  response.request().method() ===
                    (action === "complete" ? "PATCH" : "DELETE") &&
                  response.url().includes(`/api/workspace/todos/${rows[3].id}`),
              ),
            () =>
              action === "complete"
                ? detail
                    .getByRole("button", {
                      name: /标记为完成|Mark as complete/i,
                    })
                    .click()
                : page
                    .getByRole("alertdialog")
                    .getByRole("button", { name: /^(删除|Delete)$/i })
                    .click(),
          );
          expect(response.status()).toBe(200);
          expect(await response.json()).toMatchObject(
            action === "complete"
              ? {
                  success: true,
                  todo: {
                    id: rows[3].id,
                    title: `${prefix}-near`,
                    completed: true,
                  },
                }
              : { success: true },
          );
          const expectedRows =
            action === "complete"
              ? [
                  ...rows.slice(0, 3),
                  { ...rows[3], completed: true, updatedAt: expect.any(Date) },
                ]
              : rows.slice(0, 3);
          const actual = await todoState.read();
          expect(actual).toHaveLength(expectedRows.length);
          expect(actual).toEqual(expect.arrayContaining(expectedRows));
          await effects.checkpoint(action, {
            calendarMessages: [{ type: "user", userId: todoActor.id }],
          });
          const calendar = await readTodoCalendar(page, todoActor.id);
          expect(calendar.match(/BEGIN:VEVENT/g) ?? []).toHaveLength(2);
          for (const index of [0, 2])
            expect(calendar).toContain(`/todo/${rows[index].id}`);
          for (const index of [1, 3])
            expect(calendar).not.toContain(`/todo/${rows[index].id}`);
          if (action === "complete") {
            await expect(detail.getByRole("heading")).toHaveCSS(
              "text-decoration-line",
              "line-through",
            );
            await detail
              .getByRole("button", { name: "Close", exact: true })
              .click();
          }
          await expect(detail).toBeHidden();
          await expect(titles).toHaveCount(action === "complete" ? 3 : 0);
          for (const filter of [all, incomplete, completed, incomplete]) {
            await filter.click();
            await expect(filter).toBeChecked();
            const containsCompleted =
              action === "complete" && filter !== incomplete;
            await expect(titles).toHaveCount(
              filter === completed
                ? containsCompleted
                  ? 1
                  : 0
                : 3 + Number(containsCompleted),
            );
            await expect(
              list.getByRole("button", { name: `${prefix}-near`, exact: true }),
            ).toHaveCount(Number(containsCompleted));
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
        },
        { calendarMessages: [{ type: "user", userId: todoActor.id }] },
      );
    });
  }
}
