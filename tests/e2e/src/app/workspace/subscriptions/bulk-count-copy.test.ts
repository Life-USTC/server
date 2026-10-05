import { expect } from "@playwright/test";
import { createCountSections } from "../../../../utils/localized-count-fixture";
import {
  countCopyCheck,
  prepareCountObservation,
} from "../../../../utils/localized-count-observation";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test } from "../../api/mcp/_fixture";
import { verifyCountImport } from "./count-import-contract";

for (const count of [1, 2]) {
  for (const locale of ["en-us", "zh-cn"]) {
    test(`subscriptions.bulk-count-copy ${locale} count=${count}`, {
      tag: "@Subscription/Web",
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
        const check = countCopyCheck(locale, count);
        await gotoAndWaitForReady(page, "/workspace/subscriptions");
        await page
          .getByRole("button", {
            name: en ? "Bulk Add Subscriptions" : "批量添加订阅",
            exact: true,
          })
          .first()
          .click();
        await page
          .locator("#bulk-import-semester")
          .selectOption(String(f.semester.id));
        await page
          .locator("#bulk-import-section-codes")
          .fill(f.sections.map((section) => section.code).join("\n"));
        await page
          .getByRole("dialog")
          .getByRole("button", {
            name: en ? "Match Sections" : "识别并匹配课程",
            exact: true,
          })
          .click();
        const confirm = page
          .getByRole("dialog")
          .filter({ has: page.locator("#bulk-import-confirm-title") });
        await expect(confirm).toBeVisible();
        for (const selected of [count, 0, count]) {
          for (const checkbox of await confirm.getByRole("checkbox").all())
            await checkbox.setChecked(selected > 0);
          const title = en
            ? `Confirm ${selected} section ${selected === 1 ? "subscription" : "subscriptions"}`
            : `确认订阅 ${selected} 个教学班`;
          await check(
            confirm.locator("#bulk-import-confirm-title"),
            title,
            `bulk-title-${selected}`,
          );
          await expect.soft(confirm.locator("legend")).toHaveText(title);
          await check(
            confirm.locator('[data-slot="dialog-footer"] button').last(),
            en
              ? `Subscribe to ${selected} ${selected === 1 ? "section" : "sections"}`
              : `订阅已选的 ${selected} 个教学班`,
            `bulk-button-${selected}`,
          );
          if (selected === 0)
            await expect(
              confirm.locator('[data-slot="dialog-footer"] button').last(),
            ).toBeDisabled();
          else
            await expect(
              confirm.locator('[data-slot="dialog-footer"] button').last(),
            ).toBeEnabled();
        }
        await confirm
          .locator('[data-slot="dialog-footer"] button')
          .last()
          .click();
        await expect(
          page.locator("[data-sonner-toast]").filter({
            hasText: en
              ? `Added ${count} new ${count === 1 ? "section" : "sections"} to Life@USTC`
              : `已新增 ${count} 个教学班订阅`,
          }),
        ).toBeVisible();
        await expect(
          page
            .getByText(
              en
                ? `${count} ${count === 1 ? "section" : "sections"} included`
                : `包含 ${count} 个班级`,
              { exact: true },
            )
            .first(),
        ).toBeVisible();

        return observation.checks({
          feedTokenCreated: true,
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
