import { expect } from "@playwright/test";
import { test } from "../../../../utils/homework-fixture";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { absoluteTestUrl } from "../../../../utils/request-url";

test("homework toolbar distinguishes no assignments from unmatched assignments", {
  tag: "@Homework/Web",
}, async ({ page, baseURL, academic: _academic, homeworkRun }) => {
  await homeworkRun(
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
        await gotoAndWaitForReady(page, "/workspace/homeworks");
        await expect(
          page
            .getByText("No homework yet", { exact: true })
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
            .getByText("No homework yet", { exact: true })
            .filter({ visible: true }),
        ).toBeVisible();
        await expect(
          page.getByText("No homework under this filter", { exact: true }),
        ).toHaveCount(0);
        await expect(toolbar.getByRole("searchbox")).toHaveValue("unmatched");
      }
    },
    { calendarMessages: [] },
  );
});
