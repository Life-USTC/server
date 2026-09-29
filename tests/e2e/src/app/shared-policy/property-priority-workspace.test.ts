import { test } from "@playwright/test";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db/core";
import { checkWorkspaceCalendarPriorityViews } from "../../../utils/property-priority-workspace-calendar";
import { checkWorkspaceEventPriorityViews } from "../../../utils/property-priority-workspace-events";
import {
  cleanupWorkspacePriorityFixture,
  createWorkspacePriorityFixture,
} from "../../../utils/property-priority-workspace-fixture";
import { checkWorkspaceOverviewPriorityViews } from "../../../utils/property-priority-workspace-overview";
import { checkWorkspaceTaskPriorityViews } from "../../../utils/property-priority-workspace-tasks";
import { createSignedSessionCookie } from "../../../utils/signed-session-cookie";

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
      }) => {
        test.setTimeout(120_000);
        page.setDefaultTimeout(5_000);
        const data = await createWorkspacePriorityFixture();
        try {
          await page
            .context()
            .addCookies([
              await createSignedSessionCookie(data.user.id),
              { name: "NEXT_LOCALE", value: locale, url: PLAYWRIGHT_BASE_URL },
            ]);
          await page.setViewportSize({ width, height: 844 });
          await check(page, data, locale, width);
        } finally {
          await cleanupWorkspacePriorityFixture(data);
        }
      });
    }
  }
}
