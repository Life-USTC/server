import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import {
  expectTodoFormResponse,
  readTodoCalendar,
  test,
} from "../../../utils/todo-fixture";

for (const [locale, width] of [
  ["en-us", 1280],
  ["zh-cn", 390],
] as const) {
  for (const [domain, branch] of [
    ["Overview", "overview"],
    ["Homework", "homeworks"],
    ["Exam", "exams"],
    ["Todo", "todos"],
  ] as const) {
    test(`ui.workspace-filters-and-empty-states-6 ${locale}/${width} ${domain}`, {
      tag: `@${domain}/Web`,
    }, async ({ page, todoRun, todoActor, todoState, isolatedWorker }) => {
      await todoRun(
        async (effects) => {
          const db = isolatedWorker.database.owner;
          const user = todoActor;
          const cookie = todoActor.cookie;
          const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
          await page.context().clearCookies();
          await page
            .context()
            .addCookies([
              cookie,
              { name: "NEXT_LOCALE", value: locale, url: cookie.url },
            ]);
          await page.setViewportSize({ width, height: 844 });
          if (branch !== "todos") {
            for (const destination of ["sections", "courses"]) {
              await gotoAndWaitForReady(page, `/workspace/${branch}`);
              const empty = page
                .getByRole("main")
                .locator('[data-slot="empty"]')
                .first();
              await expect(empty).toBeVisible();
              const action = empty.locator(`a[href="/catalog/${destination}"]`);
              await expect(action).toBeVisible();
              await expect(action).toHaveAccessibleName(
                destination === "sections"
                  ? /教学班|班级|Sections/i
                  : /课程|Courses/i,
              );
              await action.click();
              await expect(page).toHaveURL(
                new RegExp(`/catalog/${destination}$`),
              );
              await expect(page.getByRole("main")).toBeVisible();
              await expect(
                page.getByRole("heading", { level: 1 }),
              ).toBeVisible();
            }
          }
          expect(
            await db.userSectionSubscription.count({
              where: { userId: user.id },
            }),
          ).toBe(0);
          if (branch === "todos") {
            await gotoAndWaitForReady(page, "/workspace/todos");
            const main = page.getByRole("main");
            await expect(
              main.locator('[data-slot="empty"]').filter({ visible: true }),
            ).toBeVisible();
            const create = main.getByRole("button", {
              name: /添加待办|Add Todo/i,
            });
            await expect(create).toBeEnabled();
            await create.click();
            const dialog = page.getByRole("dialog");
            await expect(dialog).toBeVisible();
            const title = `First task ${suffix}`;
            await dialog.getByLabel(/^(标题|Title)$/i).fill(title);
            const [created] = await Promise.all([
              page.waitForResponse(
                (response) =>
                  response.request().method() === "POST" &&
                  new URL(response.url()).pathname === "/workspace/todos" &&
                  new URL(response.url()).search === "?/createTodo",
              ),
              dialog
                .getByRole("button", { name: /创建待办|Create Todo/i })
                .click(),
            ]);
            await expectTodoFormResponse(created);
            await expect(dialog).toBeHidden();
            await expect(
              main
                .getByRole("button", { name: title, exact: true })
                .filter({ visible: true }),
            ).toBeVisible();
            const todos = await db.todo.findMany({
              where: { userId: user.id },
              select: { title: true, completed: true },
            });
            expect(todos).toEqual([{ title, completed: false }]);
            expect(await todoState.read()).toEqual([
              expect.objectContaining({
                userId: user.id,
                title,
                content: null,
                completed: false,
                priority: "medium",
                dueAt: null,
              }),
            ]);
            await effects.checkpoint("first-todo-created", {
              calendarTokenCreated: false,
              calendarMessages: [{ type: "user", userId: todoActor.id }],
            });
            expect(await readTodoCalendar(page, todoActor.id)).not.toContain(
              "BEGIN:VEVENT",
            );
          }
        },
        {
          calendarTokenCreated: branch === "exams",
          calendarMessages:
            branch === "todos" ? [{ type: "user", userId: todoActor.id }] : [],
        },
      );
    });
  }
}
