import { expect, type Page, type Route } from "@playwright/test";
import { test as academicTest } from "../../../utils/homework-fixture";
import { waitForUiSettled } from "../../../utils/page-ready";
import { test as todoTest } from "../../../utils/todo-fixture";
import {
  applyWorkspaceTaskFilter,
  expectWorkspaceTaskFilterSelected,
  openWorkspaceTaskFilter,
  workspaceTaskFilterValue,
} from "../../../utils/workspace-task-filters";

academicTest.describe.configure({ mode: "parallel" });
for (const tab of ["homeworks", "todos", "exams"] as const) {
  const verify = async (page: Page) => {
    let releaseScripts = () => {};
    const scriptsReady = new Promise<void>((resolve) => {
      releaseScripts = resolve;
    });
    const pendingScripts = new Set<Promise<void>>();
    const scriptErrors: unknown[] = [];
    const holdScript = async (route: Route) => {
      await scriptsReady;
      const operation = route.fallback();
      pendingScripts.add(operation);
      try {
        await operation;
      } catch (error) {
        scriptErrors.push(error);
      } finally {
        pendingScripts.delete(operation);
      }
    };
    await page.route("**/_app/immutable/**/*.js", holdScript);
    try {
      await page.goto(`/workspace/${tab}`, { waitUntil: "commit" });
      const trigger = page
        .locator('[data-slot="table-column-header"]')
        .getByRole("button", {
          name: tab === "exams" ? /^(日期|Date)$/i : /^(状态|Status)$/i,
        })
        .filter({ visible: true })
        .first();
      await expect(trigger).toBeVisible();
      await expect(trigger).toBeDisabled();

      releaseScripts();
      await waitForUiSettled(page);
      await expect(trigger).toBeEnabled();
      await openWorkspaceTaskFilter(page, tab);
      const group = page.locator('[data-filter-field="completion"]:visible');
      const options = group.getByRole("checkbox");
      await expect(options).toHaveCount(tab === "homeworks" ? 4 : 2);
      for (const option of await options.all()) {
        await expect(option).toBeVisible();
        await expect(option).toBeEnabled();
      }

      await page.context().setOffline(true);
      for (const value of ["all", "completed", "incomplete"]) {
        const option = workspaceTaskFilterValue(page, value);
        await expect(option).toBeEnabled();
        await applyWorkspaceTaskFilter(page, option);
        await expectWorkspaceTaskFilterSelected(option);
      }
    } catch (error) {
      scriptErrors.push(error);
    } finally {
      releaseScripts();
      try {
        await page.context().setOffline(false);
      } catch (error) {
        scriptErrors.push(error);
      }
      try {
        // Remove only this scenario's script gate. The private workflow still
        // owns its routes, admitted reads and native effect observations.
        await page.unroute("**/_app/immutable/**/*.js", holdScript);
      } catch (error) {
        scriptErrors.push(error);
      }
      while (pendingScripts.size) await Promise.allSettled(pendingScripts);
    }
    if (scriptErrors.length === 1) throw scriptErrors[0];
    if (scriptErrors.length)
      throw new AggregateError(
        scriptErrors,
        "Task filter readiness and cleanup failed",
      );
  };
  if (tab === "todos") {
    todoTest(
      `ui.workspace-filters-and-empty-states-2 (${tab})`,
      { tag: "@Todo/Web" },
      async ({ page, todoRun }) => {
        await todoRun(() => verify(page), { calendarMessages: [] });
      },
    );
  } else {
    academicTest(
      `ui.workspace-filters-and-empty-states-2 (${tab})`,
      { tag: `@${tab === "exams" ? "Exam" : "Homework"}/Web` },
      async ({ page, academic: _academic, homeworkRun }) => {
        await homeworkRun(() => verify(page), {
          calendarMessages: [],
          calendarTokenCreated: tab === "exams",
        });
      },
    );
  }
}
