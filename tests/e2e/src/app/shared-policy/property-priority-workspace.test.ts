import { checkWorkspaceCalendarPriorityViews } from "../../../utils/property-priority-workspace-calendar";
import { checkWorkspaceEventPriorityViews } from "../../../utils/property-priority-workspace-events";
import { test } from "../../../utils/property-priority-workspace-fixture";
import { checkWorkspaceOverviewPriorityViews } from "../../../utils/property-priority-workspace-overview";
import { checkWorkspaceTaskPriorityViews } from "../../../utils/property-priority-workspace-tasks";

// Each consumer owns a fresh state and can be scheduled without earlier views.
test.describe.configure({ mode: "parallel" });
for (const [consumer, check] of [
  ["tasks", checkWorkspaceTaskPriorityViews],
  ["overview", checkWorkspaceOverviewPriorityViews],
  ["events", checkWorkspaceEventPriorityViews],
  ["calendar", checkWorkspaceCalendarPriorityViews],
] as const) {
  for (const locale of ["zh-cn", "en-us"] as const) {
    for (const width of [1280, 390]) {
      test(`workspace presentation ${consumer} ${locale}/${width}`, async ({
        page,
        workspacePriority: data,
        workspacePriorityRun,
      }) => {
        test.setTimeout(120_000);
        page.setDefaultTimeout(5_000);
        await workspacePriorityRun(consumer, async ({ headers }) => {
          await page
            .context()
            .addCookies([
              { name: "NEXT_LOCALE", value: locale, url: data.origin },
            ]);
          await page.setViewportSize({ width, height: 844 });
          await check(page, data, locale, width, headers);
        });
      });
    }
  }
}
