import { checkWorkspaceCalendarPriorityViews } from "../../../utils/property-priority-workspace-calendar";
import { checkWorkspaceEventPriorityViews } from "../../../utils/property-priority-workspace-events";
import { test } from "../../../utils/property-priority-workspace-fixture";
import { checkWorkspaceOverviewPriorityViews } from "../../../utils/property-priority-workspace-overview";
import { checkWorkspaceTaskPriorityViews } from "../../../utils/property-priority-workspace-tasks";

// Each consumer owns a fresh state and can be scheduled without earlier views.
test.describe.configure({ mode: "parallel" });
for (const domain of [
  "Todo",
  "Homework",
  "Exam",
  "Overview",
  "Calendar",
  "Schedule",
  "Subscription",
] as const) {
  for (const locale of ["zh-cn", "en-us"] as const) {
    for (const width of [1280, 390]) {
      test(`workspace presentation ${domain} ${locale}/${width}`, {
        tag: `@${domain}/Web`,
      }, async ({ page, workspacePriority: data, workspacePriorityRun }) => {
        test.setTimeout(120_000);
        page.setDefaultTimeout(5_000);
        await workspacePriorityRun(domain, async ({ headers }) => {
          await page
            .context()
            .addCookies([
              { name: "NEXT_LOCALE", value: locale, url: data.origin },
            ]);
          await page.setViewportSize({ width, height: 844 });
          if (domain === "Todo" || domain === "Homework" || domain === "Exam") {
            await checkWorkspaceTaskPriorityViews(
              page,
              data,
              locale,
              width,
              domain,
            );
          } else if (domain === "Schedule" || domain === "Subscription") {
            await checkWorkspaceCalendarPriorityViews(
              page,
              data,
              locale,
              width,
              headers,
              domain,
            );
          } else if (domain === "Overview") {
            await checkWorkspaceOverviewPriorityViews(
              page,
              data,
              locale,
              width,
            );
          } else {
            await checkWorkspaceEventPriorityViews(page, data, locale, width);
            await checkWorkspaceCalendarPriorityViews(
              page,
              data,
              locale,
              width,
              headers,
              domain,
            );
          }
        });
      });
    }
  }
}
