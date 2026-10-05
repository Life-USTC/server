import { expect } from "@playwright/test";
import { createCountSections } from "../../../../utils/localized-count-fixture";
import {
  countCopyCheck,
  prepareCountObservation,
} from "../../../../utils/localized-count-observation";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test } from "../../api/mcp/_fixture";

for (const count of [0, 1, 2]) {
  test(`subscriptions.search-count-copy count=${count}`, {
    tag: "@Subscription/Web",
  }, async ({ page, request, isolatedWorker, calendarProtocolRun }) => {
    test.setTimeout(300_000);
    const baseURL = isolatedWorker.origin;
    const db = isolatedWorker.database.owner;
    await calendarProtocolRun(async (io) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const f = await db.$transaction((tx) => createCountSections(tx, count));
      const actor = await isolatedWorker.createSession(f.owner.id);
      await io.observeCalendar(f.owner, [], { calendar: "absent" });
      const observation = await prepareCountObservation(
        isolatedWorker,
        request,
        f.owner.id,
      );
      for (const locale of ["en-us", "zh-cn"]) {
        await page.context().clearCookies();
        await page
          .context()
          .addCookies([{ name: "NEXT_LOCALE", value: locale, url: baseURL }]);
        const en = locale === "en-us";
        const check = countCopyCheck(locale, count);
        await page.context().addCookies([actor.cookie]);
        await gotoAndWaitForReady(page, "/workspace/subscriptions");
        await page
          .getByRole("button", {
            name: en ? "Add Subscription" : "添加订阅",
            exact: true,
          })
          .first()
          .click();
        await page
          .locator("#subscriptions-quick-add-semester")
          .selectOption(String(f.semester.id));
        await page.locator("#subscriptions-quick-add-code").fill(f.course.code);
        await page
          .getByRole("dialog")
          .getByRole("button", { name: en ? "Search" : "搜索", exact: true })
          .click();
        if (count === 0) {
          await expect(
            page
              .getByRole("dialog")
              .getByText(en ? "No sections found" : "没有找到教学班", {
                exact: true,
              }),
          ).toBeVisible();
        } else {
          await check(
            page.getByRole("dialog").locator("legend"),
            en
              ? `${count} ${count === 1 ? "section" : "sections"} found`
              : `找到 ${count} 个教学班`,
            "quick-add",
          );
        }
        await page
          .getByRole("dialog")
          .getByRole("button", { name: en ? "Cancel" : "取消", exact: true })
          .click();
      }
      return observation.checks({
        sessionRefreshed: true,
        feedTokenCreated: true,
        subscriptions: [],
        writes: [],
      });
    });
  });
}
