import { test } from "@playwright/test";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db/core";
import { createPriorityViewAudit } from "../../../utils/property-priority";
import { checkWorkspaceCalendarPriorityViews } from "../../../utils/property-priority-workspace-calendar";
import {
  cleanupWorkspacePriorityFixture,
  createWorkspacePriorityFixture,
} from "../../../utils/property-priority-workspace-fixture";
import { checkWorkspaceOverviewPriorityViews } from "../../../utils/property-priority-workspace-overview";
import { checkWorkspaceTaskPriorityViews } from "../../../utils/property-priority-workspace-tasks";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

test("ui.model-property-priority-workspace-views", async ({ page }) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(5_000);
  const data = await createWorkspacePriorityFixture();
  try {
    await page
      .context()
      .addCookies([await createSignedSessionCookie(data.user.id)]);
    for (const locale of ["zh-cn", "en-us"] as const) {
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: locale, url: PLAYWRIGHT_BASE_URL },
        ]);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        const audit = createPriorityViewAudit("workspace");
        await checkWorkspaceTaskPriorityViews(audit, page, data, locale, width);
        await checkWorkspaceOverviewPriorityViews(
          audit,
          page,
          data,
          locale,
          width,
        );
        await checkWorkspaceCalendarPriorityViews(
          audit,
          page,
          data,
          locale,
          width,
        );
        audit.finish();
      }
    }
  } finally {
    await cleanupWorkspacePriorityFixture(data);
  }
});
