import { expect, type Locator, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import {
  cleanupRemainingCountFixture,
  createRemainingCountFixture,
  resetCountSubscriptions,
  setCountPublications,
} from "../../../utils/remaining-count-policy-fixture";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

test("ui.localized-count-copy-1", async ({ page, baseURL }, testInfo) => {
  test.setTimeout(300_000);
  if (!baseURL) throw new Error("Missing Playwright baseURL");
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const count of [0, 1, 2]) {
    const f = await createRemainingCountFixture(count);
    try {
      for (const locale of ["en-us", "zh-cn"]) {
        await setCountPublications(f, 0);
        await resetCountSubscriptions(f);
        await page.context().clearCookies();
        await page
          .context()
          .addCookies([{ name: "NEXT_LOCALE", value: locale, url: baseURL }]);
        const en = locale === "en-us";
        async function check(
          locator: Locator,
          expected: string,
          label: string,
        ) {
          await expect
            .soft(locator, `${locale} ${count}: ${label}`)
            .toHaveText(expected);
          if (count === 1)
            await locator.screenshot({
              path: testInfo.outputPath(`count-${locale}-${label}.png`),
            });
        }
        const eventSummary = en
          ? `Showing ${count} of ${count} ${count === 1 ? "event" : "events"}`
          : `显示 ${count} 个活动中的 ${count} 个`;
        for (const item of [
          { name: "events", path: `/catalog/young-events?search=${f.marker}` },
          {
            name: "calendar",
            path: `/catalog/young-events/calendar?search=${f.marker}&view=day&date=2035-09-15`,
          },
          {
            name: "organizer-history",
            path: `/catalog/young-events/organizers/${f.contextOrganizer.id}`,
          },
        ]) {
          await gotoAndWaitForReady(page, item.path);
          await check(
            page.locator('[data-slot="results-summary"] > p'),
            eventSummary,
            item.name,
          );
        }
        await gotoAndWaitForReady(
          page,
          `/catalog/young-events/organizers?search=${f.marker}`,
        );
        await check(
          page.locator('[data-slot="results-summary"] > p'),
          en
            ? `Showing ${count} of ${count} ${count === 1 ? "organizer" : "organizers"}`
            : `显示 ${count} 个主办方中的 ${count} 个`,
          "organizers",
        );
        await gotoAndWaitForReady(page, `/news?query=${f.marker}`);
        await check(
          page.locator('[data-slot="results-summary"] > p'),
          en
            ? `${count} ${count === 1 ? "result" : "results"}`
            : `共 ${count} 条`,
          "news",
        );
        await gotoAndWaitForReady(page, "/news/sources");
        if (count === 0) {
          await expect(
            page.locator('[data-slot="results-summary"] > p'),
          ).toHaveCount(0);
        } else {
          await check(
            page.locator('[data-slot="results-summary"] > p'),
            en
              ? `${count} ${count === 1 ? "source" : "sources"} · ${count} ${count === 1 ? "publication" : "publications"}`
              : `共 ${count} 个来源、${count} 篇内容`,
            "source-total",
          );
          await check(
            page.locator('[data-slot="card-header"] span.text-sm').first(),
            en
              ? `${count} ${count === 1 ? "source" : "sources"} · ${count} ${count === 1 ? "publication" : "publications"}`
              : `${count} 个来源 · ${count} 篇内容`,
            "source-group",
          );
          await setCountPublications(f, count);
          await gotoAndWaitForReady(page, `/news?query=${f.marker}&fold=1`);
          await check(
            page
              .locator('main [data-slot="badge"]')
              .filter({ hasText: /^(\+|另有)/ }),
            en
              ? `+${count} more ${count === 1 ? "section" : "sections"}`
              : `另有 ${count} 个栏目转载`,
            "news-fold",
          );
          for (const publications of [count * 2, 0]) {
            if (publications === 0) await setCountPublications(f, null);
            await gotoAndWaitForReady(page, "/news/sources");
            await check(
              page.locator('[data-slot="results-summary"] > p'),
              en
                ? `${count} ${count === 1 ? "source" : "sources"} · ${publications} publications`
                : `共 ${count} 个来源、${publications} 篇内容`,
              `source-mixed-${publications}`,
            );
          }
        }
        await gotoAndWaitForReady(page, `/catalog/courses/${f.course.jwId}`);
        const hidden = page
          .locator('#comments [data-slot="alert-description"]')
          .filter({ hasText: en ? "Log in to view" : "仅登录后可见" });
        if (count === 0) await expect(hidden).toHaveCount(0);
        else
          await check(
            hidden,
            en
              ? `${count} ${count === 1 ? "comment is" : "comments are"} hidden. Log in to view ${count === 1 ? "it" : "them"}.`
              : `有 ${count} 条评论仅登录后可见。`,
            "hidden-comments",
          );

        await page
          .context()
          .addCookies([await createSignedSessionCookie(f.owner.id)]);
        await gotoAndWaitForReady(page, "/account/settings/security");
        const repeated = page
          .locator(
            'section[aria-labelledby="security-activity-title"] [data-slot="badge"]',
          )
          .filter({ hasText: en ? "consecutive events" : /连续 \d+ 次/ });
        if (count < 2) await expect(repeated).toHaveCount(0);
        else
          await check(
            repeated,
            en ? "2 consecutive events" : "连续 2 次",
            "security-repeated",
          );
        for (const item of [
          {
            name: "users",
            path: `/admin/users?search=${f.marker}-member`,
            expected: en
              ? `Showing ${count} of ${count} ${count === 1 ? "user" : "users"}`
              : `显示 ${count} / 共 ${count} 位用户`,
          },
          {
            name: "clients",
            path: "/admin/oauth",
            expected: en
              ? `${count} ${count === 1 ? "client" : "clients"}`
              : `${count} 个客户端`,
          },
          {
            name: "descriptions",
            path: `/admin/moderation?tab=descriptions&search=${f.marker}`,
            expected: en
              ? `Showing ${count} ${count === 1 ? "result" : "results"}`
              : `显示 ${count} 条结果`,
          },
        ]) {
          await gotoAndWaitForReady(page, item.path);
          await check(
            page.locator('main section > div > [data-slot="badge"]').first(),
            item.expected,
            item.name,
          );
        }
        await gotoAndWaitForReady(
          page,
          "/workspace/subscriptions/activities?view=notifications",
        );
        const notifications = page.locator(
          'main [data-slot="item-group"] > [data-slot="item"]',
        );
        await expect(notifications).toHaveCount(count);
        if (count > 0)
          await check(
            notifications.first().locator("p"),
            en
              ? `${count} new ${count === 1 ? "activity" : "activities"}: Count grammar activity`
              : `${count} 个新活动：Count grammar activity`,
            "digest",
          );

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
        if (count > 0) {
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

          await resetCountSubscriptions(f);
          await gotoAndWaitForReady(
            page,
            "/account/welcome?step=subscriptions",
          );
          await page
            .locator("#welcome-bulk-import-semester")
            .selectOption(String(f.semester.id));
          await page
            .locator("#welcome-bulk-import-section-codes")
            .fill(f.sections.map((section) => section.code).join("\n"));
          await page
            .getByRole("button", { name: en ? "Import" : "导入", exact: true })
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
        }
      }
    } finally {
      await cleanupRemainingCountFixture(f);
    }
  }
});
