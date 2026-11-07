import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { absoluteTestUrl } from "../../../../utils/request-url";
import { test } from "../../../../utils/todo-fixture";
import { expectTaskToolbarDraftContract } from "../../../../utils/workspace-task-toolbar-contract";

test("todos.filter-toolbar-evidence", { tag: "@Todo/Web" }, async ({
  page,
  baseURL,
  todoRun,
  todoState,
}) => {
  await todoRun(
    async () => {
      await todoState.seed([
        {
          title: "Plan weekly study",
          content: "Review lecture notes",
          priority: "high",
          dueAt: new Date("2099-01-03T12:30:00+08:00"),
        },
        { title: "Read course materials", priority: "medium", dueAt: null },
        { title: "Completed planning", completed: true },
      ]);
      for (const locale of ["zh-cn", "en-us"])
        for (const width of [390, 1280]) {
          await page.context().addCookies([
            {
              name: "NEXT_LOCALE",
              value: locale,
              url: absoluteTestUrl("/", baseURL),
            },
          ]);
          await page.setViewportSize({ width, height: 900 });
          await gotoAndWaitForReady(page, "/workspace/todos");
          await expect(
            width === 390
              ? page.getByTestId("workspace-todos-cards")
              : page.getByRole("table"),
          ).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          if (process.env.FILTER_EVIDENCE_DIR)
            await page.screenshot({
              path: `${process.env.FILTER_EVIDENCE_DIR}/todos-${locale}-${width}.png`,
              fullPage: true,
              animations: "disabled",
            });
        }
      await expectTaskToolbarDraftContract(page, "todos", "Plan weekly study");
    },
    { calendarMessages: [] },
  );
});
