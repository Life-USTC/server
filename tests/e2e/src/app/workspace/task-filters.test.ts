import {
  expect,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import {
  applyWorkspaceTaskFilter,
  openWorkspaceTaskFilter,
  test,
  workspaceTaskFilterValue,
} from "../../../utils/workspace-task-filters";

function taskTitle(
  page: Page,
  tab: "homeworks" | "todos" | "exams",
  title: string,
) {
  // Room previews repeat the room code; count the task's trigger, not its popup.
  const locator =
    tab === "exams"
      ? page
          .getByTestId("room-map-preview")
          .getByRole("button", { name: new RegExp(title, "i") })
      : page.getByText(title, { exact: true });
  return locator.filter({ visible: true });
}

test("workspace table filters share drafts across columns", {
  tag: "@Todo/Web",
}, async ({ page, taskFilterState, taskFilterRun }) => {
  const fixture = await taskFilterState(true);
  await taskFilterRun(
    async () => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await gotoAndWaitForReady(page, "/workspace/todos");
      const completed = taskTitle(page, "todos", fixture.completedTitle.todos);
      const pending = taskTitle(page, "todos", fixture.pendingTitle.todos);
      await openWorkspaceTaskFilter(page, "todos");
      await workspaceTaskFilterValue(page, "completed").check();
      await page.keyboard.press("Escape");
      const headers = page.locator('[data-slot="table-column-header"]:visible');
      await headers
        .getByRole("button", { name: /^(优先级|Priority)$/i })
        .click();
      const priority = page.locator('[data-filter-field="priority"]:visible');
      await priority.getByRole("checkbox", { name: /^(高|High)$/i }).check();
      await priority.getByRole("checkbox", { name: /^(中|Medium)$/i }).check();
      await page.keyboard.press("Escape");
      await headers.getByRole("button", { name: /^(标题|Title)$/i }).click();
      await page
        .locator('[data-filter-field="title"]:visible input')
        .fill(fixture.completedTitle.todos);
      await page.keyboard.press("Escape");
      await expect(completed).toHaveCount(0);
      await expect(pending).toHaveCount(1);
      await headers
        .getByRole("button", { name: /^(优先级|Priority)$/i })
        .click();
      await expect(
        priority.getByRole("checkbox", { checked: true }),
      ).toHaveCount(2);
      await page.keyboard.press("Escape");
      const apply = page.getByRole("button", {
        name: /^(应用筛选|Apply filters)$/i,
      });
      await expect(apply).toHaveCount(1);
      await apply.click();
      await expect(completed).toHaveCount(1);
      await expect(pending).toHaveCount(0);
      await headers.getByRole("button", { name: /^(标题|Title)$/i }).click();
      await page.locator('[data-filter-field="title"]:visible input').fill("");
      await page.keyboard.press("Escape");
      await apply.click();
      await expect(completed).toHaveCount(1);
      await expect(pending).toHaveCount(1);
    },
    { calendarMessages: [], calendarTokenCreated: false },
  );
});

async function expectSelection(group: Locator, selected: string) {
  const checked = group.getByRole("checkbox", { checked: true });
  await expect(checked).toHaveCount(selected === "all" ? 0 : 1);
  if (selected === "all") {
    await expect(group.getByRole("button").first()).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  } else {
    const name =
      selected === "completed"
        ? /^(已完成|Completed|Ended|已结束)$/i
        : /^(未完成|Incomplete|Upcoming|未结束)$/i;
    await expect(group.getByRole("checkbox", { name })).toBeChecked();
    await expect(group.getByRole("checkbox", { name })).toHaveAttribute(
      "data-state",
      "checked",
    );
  }
}

test("task filters respond after navigating between workspace pages", {
  tag: "@Site/Web",
}, async ({ page, isMobile, taskFilterState, taskFilterRun }) => {
  const fixture = await taskFilterState(true);
  await taskFilterRun(
    async () => {
      await gotoAndWaitForReady(page, "/workspace/homeworks");
      for (const tab of ["todos", "exams", "homeworks", "todos"] as const) {
        if (isMobile)
          await page.locator('[data-slot="sidebar-trigger"]').click();
        await page
          .locator(`a[href="/workspace/${tab}"]`)
          .filter({ visible: true })
          .first()
          .click();
        await page.waitForURL(`**/workspace/${tab}`);
        await openWorkspaceTaskFilter(page, tab);
        const group = page.locator('[data-filter-field="completion"]:visible');
        for (const value of ["all", "completed", "incomplete"]) {
          await applyWorkspaceTaskFilter(
            page,
            workspaceTaskFilterValue(page, value),
          );
          await page.mouse.move(0, 0);
          await expectSelection(group, value);
          await expect(
            taskTitle(page, tab, fixture.completedTitle[tab]),
          ).toHaveCount(value === "incomplete" ? 0 : 1);
        }
        await page.keyboard.press("Escape");
      }
    },
    { calendarMessages: [], calendarTokenCreated: true },
  );
});

for (const tab of ["homeworks", "todos", "exams"] as const) {
  for (const mobile of [false, true]) {
    for (const includePending of [false, true]) {
      test(`ui.workspace-filters-and-empty-states-1 (${tab}, ${mobile ? "mobile" : "desktop"}, ${includePending ? "pending" : "completed-only"})`, {
        tag: `@${{ homeworks: "Homework", todos: "Todo", exams: "Exam" }[tab]}/Web`,
      }, async ({ page, taskFilterState, taskFilterRun, taskFilterDb }) => {
        await page.setViewportSize(
          mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
        );
        const fixture = await taskFilterState(includePending);
        const rebuild = { type: "user" as const, userId: fixture.userId };
        const calendarMessages =
          includePending && tab !== "exams" ? [rebuild] : [];
        const effects = {
          calendarTokenCreated: tab === "exams",
          calendarMessages,
        };
        await taskFilterRun(
          async ({ activeReads, duringRemoval, checkpoint }) => {
            // Each domain observes its own mutations and token-free or token-creating reads.
            const step = `ui.workspace-filters-and-empty-states-1 (${tab}, ${mobile ? "mobile" : "desktop"}, ${includePending ? "pending" : "completed-only"})`;
            await test.step(step, async () => {
              const errors: string[] = [];
              const onPageError = (error: Error) => errors.push(error.message);
              const failures: unknown[] = [];
              page.on("pageerror", onPageError);
              try {
                await gotoAndWaitForReady(page, `/workspace/${tab}`, {
                  browserHealth: {},
                });
                const filterDialog = await openWorkspaceTaskFilter(page, tab);
                const group = page.locator(
                  '[data-filter-field="completion"]:visible',
                );
                const completed = taskTitle(
                  page,
                  tab,
                  fixture.completedTitle[tab],
                );
                const pending = taskTitle(page, tab, fixture.pendingTitle[tab]);
                await expectSelection(group, "incomplete");
                await expect(completed).toHaveCount(0);
                await expect(pending).toHaveCount(includePending ? 1 : 0);

                if (!includePending) {
                  const clear = page
                    .getByRole("button", { name: /清除筛选|Clear filter/i })
                    .filter({ visible: true });
                  if (!mobile) {
                    await expect(page.getByRole("table")).toBeVisible();
                    await expect(
                      page.getByRole("columnheader").first(),
                    ).toBeVisible();
                    await expect(
                      page
                        .getByRole("columnheader")
                        .locator('[data-slot="table-column-header"]')
                        .getByRole("button")
                        .first(),
                    ).toBeVisible();
                  }
                  if (tab === "todos") {
                    await page.keyboard.press("Escape");
                    await expect(filterDialog).toBeHidden();
                    await clear.click();
                    await openWorkspaceTaskFilter(page, tab);
                  } else {
                    await expect(clear).toHaveCount(0);
                    await applyWorkspaceTaskFilter(
                      page,
                      workspaceTaskFilterValue(page, "all"),
                    );
                  }
                  await expectSelection(group, "all");
                  await expect(completed).toHaveCount(1);
                  // Only the currently active read for this removed card belongs
                  // to the action. Later requests retain the ordinary strict guard.
                  const roomPath =
                    tab === "exams"
                      ? `/api/catalog/rooms/${encodeURIComponent(fixture.completedTitle.exams.trim().normalize("NFKC").toUpperCase())}/map`
                      : undefined;
                  const removedRequests = activeReads().filter(
                    (request) =>
                      request.method() === "GET" &&
                      !request.serviceWorker() &&
                      request.frame() === page.mainFrame() &&
                      new URL(request.url()).pathname === roomPath,
                  );
                  await duringRemoval(removedRequests, async () => {
                    await applyWorkspaceTaskFilter(
                      page,
                      workspaceTaskFilterValue(page, "incomplete"),
                    );
                    await expect(completed).toHaveCount(0);
                  });
                }

                // Filtering loaded data must keep working without network access.
                await page.context().setOffline(true);
                for (const selected of [
                  "all",
                  "completed",
                  "incomplete",
                  "all",
                ]) {
                  const option = workspaceTaskFilterValue(page, selected);
                  for (const action of ["click", "click", "space"] as const) {
                    await applyWorkspaceTaskFilter(page, option, action);
                    await page.mouse.move(0, 0);
                    await expectSelection(group, selected);
                    await expect(completed).toHaveCount(
                      selected === "incomplete" ? 0 : 1,
                    );
                    await expect(pending).toHaveCount(
                      includePending && selected !== "completed" ? 1 : 0,
                    );
                  }
                }
                await page.context().setOffline(false);
                // A fresh page uses the default filter, even if its result is empty.
                await page.keyboard.press("Escape");
                await gotoAndWaitForReady(page, `/workspace/${tab}`);
                await openWorkspaceTaskFilter(page, tab);
                await expectSelection(group, "incomplete");
                await expect(completed).toHaveCount(0);
                await expect(pending).toHaveCount(includePending ? 1 : 0);
                if (includePending && tab !== "exams") {
                  const observed: Response[] = [];
                  const observeSave = (response: Response) => {
                    if (
                      !observed.length &&
                      response.url().includes(`/${tab}/`) &&
                      ["POST", "PATCH", "PUT"].includes(
                        response.request().method(),
                      )
                    )
                      observed.push(response);
                  };
                  page.on("response", observeSave);
                  try {
                    await page.keyboard.press("Escape");
                    await page
                      .getByRole("button", {
                        name: /标记为完成|Mark as complete/i,
                      })
                      .filter({ visible: true })
                      .click();
                    await expect
                      .poll(() => observed.length === 1, {
                        timeout: 15_000,
                        message: "The actual completion response arrives",
                      })
                      .toBe(true);
                  } finally {
                    // No response waiter survives a failed click or assertion.
                    page.off("response", observeSave);
                  }
                  const response = observed[0];
                  if (!response)
                    throw new Error("Completion response is missing");
                  expect(response.ok()).toBe(true);
                  await response.body();
                  // Observe persisted state independently of the browser projection.
                  if (tab === "homeworks") {
                    const stored = await taskFilterDb((db) =>
                      db.homework.findFirstOrThrow({
                        where: {
                          sectionId: fixture.sectionId,
                          title: fixture.pendingTitle.homeworks,
                        },
                        include: {
                          homeworkCompletions: {
                            where: { userId: fixture.userId },
                          },
                        },
                      }),
                    );
                    expect(stored.homeworkCompletions).toHaveLength(1);
                  } else {
                    const stored = await taskFilterDb((db) =>
                      db.todo.findFirstOrThrow({
                        where: {
                          userId: fixture.userId,
                          title: fixture.pendingTitle.todos,
                        },
                      }),
                    );
                    expect(stored.completed).toBe(true);
                  }
                  await page.mouse.move(0, 0);
                  await openWorkspaceTaskFilter(page, tab);
                  await expectSelection(group, "incomplete");
                  await expect(pending).toHaveCount(0);
                  await expect(completed).toHaveCount(0);
                  if (tab === "todos") {
                    await page.keyboard.press("Escape");
                    await expect(filterDialog).toBeHidden();
                    await page
                      .getByRole("button", { name: /清除筛选|Clear filter/i })
                      .filter({ visible: true })
                      .click();
                    await openWorkspaceTaskFilter(page, tab);
                  } else {
                    await expect(
                      page
                        .getByRole("button", {
                          name: /清除筛选|Clear filter/i,
                        })
                        .filter({ visible: true }),
                    ).toHaveCount(0);
                    await applyWorkspaceTaskFilter(
                      page,
                      workspaceTaskFilterValue(page, "all"),
                    );
                  }
                  await expectSelection(group, "all");
                  await expect(pending).toHaveCount(1);
                  await expect(completed).toHaveCount(1);
                  await page.keyboard.press("Escape");
                  await gotoAndWaitForReady(page, `/workspace/${tab}`);
                  await openWorkspaceTaskFilter(page, tab);
                  await expectSelection(group, "incomplete");
                  await expect(pending).toHaveCount(0);
                  await applyWorkspaceTaskFilter(
                    page,
                    workspaceTaskFilterValue(page, "completed"),
                  );
                  await expect(pending).toHaveCount(1);
                }
                expect(errors).toEqual([]);
              } catch (error) {
                failures.push(error);
              } finally {
                try {
                  await page.context().setOffline(false);
                } catch (error) {
                  failures.push(error);
                } finally {
                  page.off("pageerror", onPageError);
                }
              }
              if (failures.length === 1) throw failures[0];
              if (failures.length)
                throw new AggregateError(
                  failures,
                  "Task filter assertions and offline cleanup failed",
                );
              await checkpoint(step, effects);
            });
          },
          effects,
        );
      });
    }
  }
}
