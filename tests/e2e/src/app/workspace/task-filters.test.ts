import {
  expect,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/workspace-task-filters";

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

async function expectSelection(group: Locator, selected: string) {
  const states = await group.getByRole("radio").evaluateAll((elements) =>
    elements.map((element) => ({
      value: element.getAttribute("data-value"),
      checked: element.getAttribute("aria-checked"),
      state: element.getAttribute("data-state"),
      background: getComputedStyle(element).backgroundColor,
    })),
  );
  for (const active of [
    states.filter((state) => state.checked === "true"),
    states.filter((state) => state.state === "on"),
    states.filter((state) => state.background !== "rgba(0, 0, 0, 0)"),
  ]) {
    expect(active.map((state) => state.value)).toEqual([selected]);
  }
}

test("task filters respond after navigating between workspace pages", async ({
  page,
  taskFilterState,
  taskFilterRun,
}) => {
  const fixture = await taskFilterState(true);
  await taskFilterRun(
    async () => {
      await gotoAndWaitForReady(page, "/workspace/homeworks");
      for (const tab of ["todos", "exams", "homeworks", "todos"] as const) {
        await page
          .locator(`a[href="/workspace/${tab}"]`)
          .filter({ visible: true })
          .first()
          .click();
        await page.waitForURL(`**/workspace/${tab}`);
        const group = page
          .locator('[data-slot="toggle-group"]')
          .filter({ has: page.locator('[data-value="incomplete"]') });
        for (const value of ["all", "completed", "incomplete"]) {
          await group.locator(`[data-value="${value}"]`).click();
          await page.mouse.move(0, 0);
          await expectSelection(group, value);
          await expect(
            taskTitle(page, tab, fixture.completedTitle[tab]),
          ).toHaveCount(value === "incomplete" ? 0 : 1);
        }
      }
    },
    { calendarMessages: [], calendarTokenCreated: true },
  );
});

for (const tab of ["homeworks", "todos", "exams"] as const) {
  for (const mobile of [false, true]) {
    for (const includePending of [false, true]) {
      test(`ui.workspace-filters-and-empty-states-1 (${tab}, ${mobile ? "mobile" : "desktop"}, ${includePending ? "pending" : "completed-only"})`, async ({
        page,
        taskFilterState,
        taskFilterRun,
        taskFilterDb,
      }) => {
        await page.setViewportSize(
          mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
        );
        const fixture = await taskFilterState(includePending);
        await taskFilterRun(
          async ({ activeReads, duringRemoval }) => {
            const errors: string[] = [];
            const onPageError = (error: Error) => errors.push(error.message);
            const failures: unknown[] = [];
            page.on("pageerror", onPageError);
            try {
              await gotoAndWaitForReady(page, `/workspace/${tab}`, {
                browserHealth: {},
              });
              const group = page
                .locator('[data-slot="toggle-group"]')
                .filter({ has: page.locator('[data-value="incomplete"]') });
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
                if (!mobile) {
                  await expect(page.getByRole("table")).toBeVisible();
                  await expect(
                    page.getByRole("columnheader").first(),
                  ).toBeVisible();
                }
                await page
                  .getByRole("button", { name: /清除筛选|Clear filter/i })
                  .filter({ visible: true })
                  .click();
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
                  await group.locator('[data-value="incomplete"]').click();
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
                const option = group.locator(`[data-value="${selected}"]`);
                for (const action of ["click", "click", "space"] as const) {
                  if (action === "space") await option.press("Space");
                  else await option.click();
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
              await gotoAndWaitForReady(page, `/workspace/${tab}`);
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
                await expectSelection(group, "incomplete");
                await expect(pending).toHaveCount(0);
                await expect(completed).toHaveCount(0);
                await page
                  .getByRole("button", { name: /清除筛选|Clear filter/i })
                  .filter({ visible: true })
                  .click();
                await expectSelection(group, "all");
                await expect(pending).toHaveCount(1);
                await expect(completed).toHaveCount(1);
                await gotoAndWaitForReady(page, `/workspace/${tab}`);
                await expectSelection(group, "incomplete");
                await expect(pending).toHaveCount(0);
                await group.locator('[data-value="completed"]').click();
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
          },
          {
            calendarTokenCreated: tab === "exams",
            calendarMessages:
              includePending && tab !== "exams"
                ? [{ type: "user", userId: fixture.userId }]
                : [],
          },
        );
      });
    }
  }
}
