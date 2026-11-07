import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { absoluteTestUrl } from "../../../utils/request-url";
import { test } from "../../../utils/todo-fixture";

test("todo toolbar distinguishes an empty collection from unmatched data", {
  tag: "@Todo/Web",
}, async ({ page, baseURL, todoRun }) => {
  await todoRun(
    async () => {
      await page.context().addCookies([
        {
          name: "NEXT_LOCALE",
          value: "en-us",
          url: absoluteTestUrl("/", baseURL),
        },
      ]);
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(page, "/workspace/todos");
        await expect(
          page
            .getByText("No todos yet", { exact: true })
            .filter({ visible: true }),
        ).toBeVisible();
        const toolbar = page.locator(
          '[data-slot="workspace-task-filter-toolbar"]',
        );
        await toolbar.getByRole("searchbox").fill("unmatched");
        await toolbar
          .getByRole("button", { name: "Apply filters", exact: true })
          .click();
        await expect(
          page
            .getByText("No todos yet", { exact: true })
            .filter({ visible: true }),
        ).toBeVisible();
        await expect(
          page.getByText("No todos match the current filter", { exact: true }),
        ).toHaveCount(0);
        await expect(toolbar.getByRole("searchbox")).toHaveValue("unmatched");
      }
    },
    { calendarMessages: [] },
  );
});
