import { expect } from "@playwright/test";
import { createCountSections } from "../../../utils/localized-count-fixture";
import { prepareCountObservation } from "../../../utils/localized-count-observation";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../api/mcp/_fixture";
import { verifyCountImport } from "../workspace/subscriptions/count-import-contract";

for (const count of [1, 2]) {
  for (const locale of ["en-us", "zh-cn"]) {
    test(`welcome.import-count-copy ${locale} count=${count}`, {
      tag: "@Account/Web",
    }, async ({ page, request, isolatedWorker, calendarProtocolRun }) => {
      test.setTimeout(300_000);
      const db = isolatedWorker.database.owner;
      await calendarProtocolRun(async (io) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        const f = await db.$transaction((tx) => createCountSections(tx, count));
        const actor = await isolatedWorker.createSession(f.owner.id);
        await io.observeCalendar(
          f.owner,
          [{ type: "user", userId: f.owner.id }],
          { calendar: "present" },
        );
        const observation = await prepareCountObservation(
          isolatedWorker,
          request,
          f.owner.id,
        );
        await page
          .context()
          .addCookies([
            actor.cookie,
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        const en = locale === "en-us";
        await gotoAndWaitForReady(page, "/account/welcome?step=subscriptions");
        await page
          .locator("#welcome-bulk-import-semester")
          .selectOption(String(f.semester.id));
        await page
          .locator("#welcome-bulk-import-section-codes")
          .fill(f.sections.map((section) => section.code).join("\n"));
        await page
          .getByRole("button", {
            name: en ? "Import" : "导入",
            exact: true,
          })
          .click();
        await page
          .getByTestId("welcome-import-results")
          .getByRole("button")
          .click();
        await expect(
          page.locator('[data-slot="alert-description"]').filter({
            hasText: en
              ? `Added ${count} new ${count === 1 ? "section" : "sections"}.`
              : `已新增 ${count} 个教学班订阅。`,
          }),
        ).toBeVisible();

        return observation.checks({
          sessionRefreshed: true,
          feedTokenCreated: false,
          subscriptions: f.sections.map((section) => ({
            userId: f.owner.id,
            sectionId: section.id,
            kind: "regular",
          })),
          writes: [
            ["POST", "/api/workspace/subscriptions/query", 200],
            ["POST", "/api/workspace/subscriptions/batch", 200],
          ],
        });
      }, verifyCountImport(count));
    });
  }
}
