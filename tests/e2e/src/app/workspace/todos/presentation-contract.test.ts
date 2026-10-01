import { expect, type Page } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { absoluteTestUrl } from "../../../../utils/request-url";
import { expectTodoFormResponse, test } from "../../../../utils/todo-fixture";

test.describe.configure({ mode: "parallel" });
const widths = [1280, 390];
function surface(page: Page, width: number) {
  return width >= 768
    ? page.getByRole("table")
    : page.getByTestId("workspace-todos-cards");
}

for (const width of widths) {
  test(`todo.mobile-toolbar-priority ${width}`, async ({
    todoRun,
    page,
    todos: _todos,
  }) => {
    await todoRun(
      async () => {
        await page.setViewportSize({ width, height: 844 });
        await gotoAndWaitForReady(page, "/workspace/todos");
        const rendered = surface(page, width);
        await expect(rendered).toBeVisible();
        await expect(surface(page, width === 390 ? 1280 : 390)).toBeHidden();
        for (const label of [
          /^(未完成|Incomplete)$/i,
          /^(已完成|Completed)$/i,
          /^(全部|All)$/i,
        ]) {
          const filter = page.getByRole("radio", { name: label });
          await expect(filter).toBeVisible();
          const box = await filter.boundingBox();
          if (width < 768) {
            expect(box?.width).toBeGreaterThanOrEqual(44);
            expect(box?.height).toBeGreaterThanOrEqual(44);
          }
          if (!box) throw new Error("Visible filter must have bounds");
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
          await filter.click();
          await expect(filter).toBeChecked();
        }
        await expect(page.getByTestId("workspace-todos-view-menu")).toHaveCount(
          0,
        );
        await expect(
          page.getByRole("radio", { name: /列表|List|卡片|Cards/i }),
        ).toHaveCount(0);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      },
      { calendarMessages: [] },
    );
  });
}

for (const locale of ["zh-CN", "en-US"] as const) {
  for (const width of widths) {
    test(`todo.web-detail ${locale}/${width}`, async ({
      todoRun,
      page,
      baseURL,
      todoState,
    }) => {
      await todoRun(
        async () => {
          const fixtures = await todoState.seed(
            (["low", "medium", "high"] as const).map((priority) => ({
              title: `Known ${priority} priority`,
              priority,
            })),
          );
          await page.context().addCookies([
            {
              name: "NEXT_LOCALE",
              value: locale.toLowerCase(),
              url: absoluteTestUrl("/", baseURL),
            },
          ]);
          await page.setViewportSize({ width, height: 844 });
          await gotoAndWaitForReady(page, "/workspace/todos");
          for (const { title, priority } of fixtures) {
            const expected =
              locale === "en-US"
                ? { low: "Low", medium: "Medium", high: "High" }[priority]
                : { low: "低", medium: "中", high: "高" }[priority];
            const row =
              width >= 768
                ? surface(page, width)
                    .getByRole("row")
                    .filter({ hasText: title })
                : surface(page, width)
                    .locator('[data-slot="item"]')
                    .filter({ hasText: title });
            const badge = row
              .locator('[data-slot="badge"]')
              .filter({ hasText: new RegExp(`^${expected}$`) });
            await expect(badge).toBeVisible();
            const color = await badge.evaluate((node) => ({
              background: getComputedStyle(node).backgroundColor,
              color: getComputedStyle(node).color,
              border: getComputedStyle(node).borderColor,
            }));
            await row.getByRole("button", { name: title, exact: true }).click();
            const dialog = page.getByRole("dialog", {
              name: title,
              exact: true,
            });
            const detailBadge = dialog
              .getByTestId("todo-detail-summary")
              .locator('[data-slot="badge"]')
              .filter({ hasText: new RegExp(`^${expected}$`) });
            await expect(detailBadge).toBeVisible();
            expect(
              await detailBadge.evaluate((node) => ({
                background: getComputedStyle(node).backgroundColor,
                color: getComputedStyle(node).color,
                border: getComputedStyle(node).borderColor,
              })),
            ).toEqual(color);
            await expect(
              dialog.getByTestId("todo-detail-summary"),
            ).not.toContainText(new RegExp(`\\b${priority}\\b`));
            await page.keyboard.press("Escape");
            await expect(dialog).toBeHidden();
          }
        },
        { calendarMessages: [] },
      );
    });
  }
}

for (const width of widths) {
  test(`todo.web-list-state ${width}`, async ({ todoRun, page, todoState }) => {
    await todoRun(
      async () => {
        await todoState.seed([{ title: "Known incomplete todo" }]);
        await page.setViewportSize({ width, height: 844 });
        await gotoAndWaitForReady(page, "/workspace/todos");
        const all = page.getByRole("radio", { name: /^(全部|All)$/i });
        const completed = page.getByRole("radio", {
          name: /^(已完成|Completed)$/i,
        });
        const incomplete = page.getByRole("radio", {
          name: /^(未完成|Incomplete)$/i,
        });
        for (const filter of [
          completed,
          completed,
          all,
          incomplete,
          completed,
        ]) {
          await filter.click();
          await expect(filter).toBeChecked();
          const empty = surface(page, width).locator('[data-slot="empty"]');
          if (filter === completed) {
            await expect(empty).toBeVisible();
            await expect(
              surface(page, width).getByRole("button", {
                name: /标记为完成|Mark as complete|取消完成|Mark as incomplete/i,
              }),
            ).toHaveCount(0);
          } else await expect(empty).toHaveCount(0);
        }
        await surface(page, width)
          .locator('[data-slot="empty-content"]')
          .getByRole("button")
          .click();
        await expect(all).toBeChecked();
        await expect(
          surface(page, width).locator('[data-slot="empty"]'),
        ).toHaveCount(0);
      },
      { calendarMessages: [] },
    );
  });
}

for (const width of widths) {
  test(`todo.web-due-order ${width}`, async ({
    todoActor,
    todoRun,
    page,
    todoState,
    isolatedWorker,
  }) => {
    await todoRun(
      async () => {
        const anchor = new Date(Math.floor(Date.now() / 60_000) * 60_000);
        const offset = (hours: number) =>
          new Date(anchor.getTime() + hours * 3_600_000);
        // Explicit creation dates make each equal-deadline pair deterministic,
        // independently of random IDs, insertion order and database clock precision.
        const inputs = [
          { title: "Order old", dueAt: offset(-180 * 24), completed: false },
          { title: "Order tomorrow", dueAt: offset(24), completed: false },
          {
            title: "Order pending tie second",
            dueAt: offset(1),
            completed: false,
          },
          {
            title: "Order pending tie first",
            dueAt: offset(1),
            completed: false,
          },
          {
            title: "Order completed tie second",
            dueAt: offset(1),
            completed: true,
          },
          {
            title: "Order completed tie first",
            dueAt: offset(1),
            completed: true,
          },
          { title: "Order past", dueAt: offset(-1), completed: true },
          { title: "Order undated pending", dueAt: null, completed: false },
          { title: "Order undated completed", dueAt: null, completed: true },
        ];
        const fixtures = await isolatedWorker.database.owner.$transaction(
          inputs.map((input, index) =>
            isolatedWorker.database.owner.todo.create({
              data: {
                ...input,
                userId: todoActor.id,
                createdAt: new Date(Date.UTC(2026, 0, index + 1)),
              },
            }),
          ),
        );
        await page.setViewportSize({ width, height: 844 });
        await gotoAndWaitForReady(page, "/workspace/todos");
        const titles = surface(page, width)
          .getByRole("button")
          .filter({ hasText: "Order " });
        const incomplete = page.getByRole("radio", {
          name: /^(未完成|Incomplete)$/i,
        });
        const completed = page.getByRole("radio", {
          name: /^(已完成|Completed)$/i,
        });
        const all = page.getByRole("radio", { name: /^(全部|All)$/i });
        const expectedIncomplete = [
          "Order old",
          "Order pending tie first",
          "Order pending tie second",
          "Order tomorrow",
          "Order undated pending",
        ];
        const expectedCompleted = [
          "Order past",
          "Order completed tie first",
          "Order completed tie second",
          "Order undated completed",
        ];
        const expectedAll = [
          "Order old",
          "Order past",
          "Order pending tie first",
          "Order pending tie second",
          "Order completed tie first",
          "Order completed tie second",
          "Order tomorrow",
          "Order undated pending",
          "Order undated completed",
        ];
        for (const [filter, expected] of [
          [all, expectedAll],
          [incomplete, expectedIncomplete],
          [completed, expectedCompleted],
          [all, expectedAll],
        ] as const) {
          await filter.click();
          await expect(filter).toBeChecked();
          await expect(titles).toHaveText(expected);
        }
        const stored = await todoState.read();
        expect(stored).toEqual(expect.arrayContaining(fixtures));
        expect(stored).toHaveLength(fixtures.length);
      },
      { calendarMessages: [] },
    );
  });

  test(`todo.web-deadline-edit-order ${width}`, async ({
    todoActor,
    todoRun,
    page,
    todoState,
  }) => {
    await todoRun(
      async (effects) => {
        const [todo, between, tied, later, undated] = await todoState.seed([
          {
            title: "Edit order oldest",
            dueAt: new Date("2026-10-02T11:00:00+08:00"),
            completed: true,
          },
          {
            title: "Edit order between",
            dueAt: new Date("2026-10-02T12:00:00+08:00"),
            completed: true,
          },
          {
            title: "Edit order existing tie",
            dueAt: new Date("2026-10-02T13:00:00+08:00"),
            completed: true,
          },
          {
            title: "Edit order later",
            dueAt: new Date("2026-10-02T14:00:00+08:00"),
            completed: true,
          },
          { title: "Edit order undated", completed: true },
        ]);
        await page.setViewportSize({ width, height: 844 });
        await gotoAndWaitForReady(page, "/workspace/todos");
        await page.evaluate(() => {
          document.documentElement.dataset.todoMutationSession = "retained";
        });
        const completed = page.getByRole("radio", {
          name: /^(已完成|Completed)$/i,
        });
        const all = page.getByRole("radio", { name: /^(全部|All)$/i });
        await completed.click();
        const list = surface(page, width);
        const titles = list
          .getByRole("button")
          .filter({ hasText: "Edit order " });
        await expect(titles).toHaveText([
          "Edit order oldest",
          "Edit order between",
          "Edit order existing tie",
          "Edit order later",
          "Edit order undated",
        ]);
        await list
          .getByRole("button", { name: todo.title, exact: true })
          .click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: /编辑待办|Edit Todo/i })
          .click();
        const editor = page.getByRole("dialog", {
          name: /编辑待办|Edit Todo/i,
        });
        await editor.locator('input[name="dueAt"]').fill("2026-10-02T12:30");
        const [edited] = await Promise.all([
          page.waitForResponse(
            (response) =>
              response.request().method() === "POST" &&
              new URL(response.url()).pathname === "/workspace/todos" &&
              new URL(response.url()).search === "?/updateTodo",
          ),
          editor
            .getByRole("button", { name: /保存修改|Save Changes/i })
            .click(),
        ]);
        await expectTodoFormResponse(edited);
        await expect(editor).toBeHidden();
        const stored = await todoState.read();
        expect(stored).toHaveLength(5);
        expect(stored).toEqual(
          expect.arrayContaining([
            {
              ...todo,
              dueAt: new Date("2026-10-02T12:30:00+08:00"),
              updatedAt: expect.any(Date),
            },
            between,
            tied,
            later,
            undated,
          ]),
        );
        // This expected order is specified independently of the response and
        // the stored rows, including the formerly oldest task's new position.
        for (const filter of [completed, all, completed]) {
          await filter.click();
          await expect(filter).toBeChecked();
          await expect(titles).toHaveText([
            "Edit order between",
            "Edit order oldest",
            "Edit order existing tie",
            "Edit order later",
            "Edit order undated",
          ]);
        }
        expect(
          await page.evaluate(
            () => document.documentElement.dataset.todoMutationSession,
          ),
        ).toBe("retained");
        await effects.checkpoint("deadline-edited", {
          calendarMessages: [{ type: "user", userId: todoActor.id }],
        });
      },
      { calendarMessages: [{ type: "user", userId: todoActor.id }] },
    );
  });
}
