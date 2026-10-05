import { expect } from "@playwright/test";
import type { Prisma } from "../../../../../src/generated/prisma-node/client";
import { createCountSections } from "../../../utils/localized-count-fixture";
import {
  countCopyCheck,
  prepareCountObservation,
} from "../../../utils/localized-count-observation";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../api/mcp/_fixture";

async function createAccountCountFixture(
  db: Prisma.TransactionClient,
  count: number,
) {
  const f = await createCountSections(db, count);
  for (let index = 0; index < count; index++) {
    await db.auditLog.create({
      data: {
        userId: f.owner.id,
        subjectUserId: f.owner.id,
        action: "account_profile_update",
        outcome: "success",
        channel: "web",
        createdAt: new Date(Date.now() - index * 1000),
      },
    });
    await db.user.create({
      data: {
        name: `${f.marker}-member-${index}`,
        email: `${f.marker}-member-${index}@example.test`,
      },
    });
    await db.description.create({
      data: {
        sectionId: f.sections[index].id,
        content: `${f.marker} description ${index}`,
        lastEditedById: f.owner.id,
        lastEditedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });
    await db.comment.create({
      data: {
        courseId: f.course.id,
        userId: f.owner.id,
        body: "Signed-in discussion",
        visibility: "logged_in_only",
      },
    });
    await db.oAuthClient.create({
      data: {
        clientId: `${f.marker}-client-${index}`,
        userId: f.owner.id,
        name: `Count grammar client ${index + 1}`,
        public: true,
        redirectUris: ["https://example.test/callback"],
        tokenEndpointAuthMethod: "none",
        grantTypes: ["authorization_code"],
      },
    });
  }
  return f;
}
for (const count of [0, 1, 2]) {
  for (const consumer of [
    "Comment",
    "Account",
    "User",
    "OAuth",
    "Description",
  ] as const) {
    test(`account.localized-count-copy count=${count} ${consumer}`, {
      tag: `@${consumer}/Web`,
    }, async ({ page, request, isolatedWorker, calendarProtocolRun }) => {
      test.setTimeout(300_000);
      const baseURL = isolatedWorker.origin;
      const db = isolatedWorker.database.owner;
      await calendarProtocolRun(async (io) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        const f = await db.$transaction((tx) =>
          createAccountCountFixture(tx, count),
        );
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
          if (consumer === "Comment") {
            await gotoAndWaitForReady(
              page,
              `/catalog/courses/${f.course.jwId}`,
            );
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
          }
          await page.context().addCookies([actor.cookie]);
          if (consumer === "Account") {
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
          }
          for (const item of [
            {
              name: "users",
              domain: "User",
              path: `/admin/users?search=${f.marker}-member`,
              expected: en
                ? `Showing ${count} of ${count} ${count === 1 ? "user" : "users"}`
                : `显示 ${count} / 共 ${count} 位用户`,
            },
            {
              name: "clients",
              domain: "OAuth",
              path: "/admin/oauth",
              expected: en
                ? `${count} ${count === 1 ? "client" : "clients"}`
                : `${count} 个客户端`,
            },
            {
              name: "descriptions",
              domain: "Description",
              path: `/admin/moderation?tab=descriptions&search=${f.marker}`,
              expected: en
                ? `Showing ${count} ${count === 1 ? "result" : "results"}`
                : `显示 ${count} 条结果`,
            },
          ]) {
            if (item.domain !== consumer) continue;
            await gotoAndWaitForReady(page, item.path);
            await check(
              page.locator('main section > div > [data-slot="badge"]').first(),
              item.expected,
              item.name,
            );
          }
        }
        return observation.checks({
          feedTokenCreated: false,
          subscriptions: [],
          writes: [],
        });
      });
    });
  }
}
