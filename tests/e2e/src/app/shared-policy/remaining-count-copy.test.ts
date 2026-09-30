import { expect, type Locator } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import {
  createRemainingCountFixture,
  resetCountSubscriptions,
  setCountPublications,
} from "../../../utils/remaining-count-policy-fixture";
import { createUploadBucket } from "../../../utils/upload-bucket";
import { test } from "../api/mcp/_fixture";

for (const count of [0, 1, 2]) {
  test(`ui.localized-count-copy-1 count=${count}`, async ({
    page,
    request,
    isolatedWorker,
    calendarProtocolRun,
  }, testInfo) => {
    test.setTimeout(300_000);
    const baseURL = isolatedWorker.origin;
    const db = isolatedWorker.database.owner;
    await calendarProtocolRun(
      async (io) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        const f = await createRemainingCountFixture(db, count);
        const actor = await isolatedWorker.createSession(f.owner.id);
        const sessions = await db.session.findMany();
        const sessionStarted = Date.now();
        await io.observeCalendar(
          f.owner,
          Array.from({ length: count > 0 ? 4 : 0 }, () => ({
            type: "user",
            userId: f.owner.id,
          })),
          { calendar: count > 0 ? "present" : "absent" },
        );
        const stable = () =>
          db.$transaction(async (tx) => ({
            users: (await tx.user.findMany({ orderBy: { id: "asc" } })).map(
              (user) => {
                if (user.id !== f.owner.id) return user;
                const {
                  calendarFeedToken: _token,
                  updatedAt: _updated,
                  ...rest
                } = user;
                return rest;
              },
            ),
            semesters: await tx.semester.findMany({ orderBy: { id: "asc" } }),
            courses: await tx.course.findMany({ orderBy: { id: "asc" } }),
            sections: await tx.section.findMany({ orderBy: { id: "asc" } }),
            descriptions: await tx.description.findMany({
              orderBy: { id: "asc" },
            }),
            comments: await tx.comment.findMany({ orderBy: { id: "asc" } }),
            clients: await tx.oAuthClient.findMany({ orderBy: { id: "asc" } }),
            organizers: await tx.youngOrganizer.findMany({
              orderBy: { id: "asc" },
            }),
            events: await tx.youngEvent.findMany({
              orderBy: { youngId: "asc" },
            }),
            notifications: await tx.youngNotification.findMany({
              orderBy: { id: "asc" },
            }),
            sources: await tx.publicationSource.findMany({
              orderBy: { id: "asc" },
            }),
          }));
        const baseline = await stable();
        const fixtureAudits = await db.auditLog.findMany({
          orderBy: { id: "asc" },
        });
        for (const locale of ["en-us", "zh-cn"]) {
          await setCountPublications(db, f, 0);
          await resetCountSubscriptions(db, f);
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
            {
              name: "events",
              path: `/catalog/young-events?search=${f.marker}`,
            },
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
              page
                .locator('[data-slot="page-section-header"] span.text-sm')
                .first(),
              en
                ? `${count} ${count === 1 ? "source" : "sources"} · ${count} ${count === 1 ? "publication" : "publications"}`
                : `${count} 个来源 · ${count} 篇内容`,
              "source-group",
            );
            await setCountPublications(db, f, count);
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
              if (publications === 0) await setCountPublications(db, f, null);
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

          await page.context().addCookies([actor.cookie]);
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
          await page
            .locator("#subscriptions-quick-add-code")
            .fill(f.course.code);
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

            await resetCountSubscriptions(db, f);
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
          }
        }
        const sessionFinished = Date.now();
        return {
          async verifyTransport({ effects, sdkRequests }) {
            expect(sdkRequests).toEqual([]);
            const writes = effects.requests.filter(
              ({ value }) => !["GET", "HEAD"].includes(value.method),
            );
            expect(
              writes.map(({ value, result }) => [
                value.method,
                value.path,
                result,
              ]),
            ).toEqual(
              count === 0
                ? []
                : Array.from({ length: 2 }, () => [
                    ["POST", "/api/workspace/subscriptions/query", 200],
                    ["POST", "/api/workspace/subscriptions/batch", 200],
                    ["POST", "/api/workspace/subscriptions/query", 200],
                    ["POST", "/api/workspace/subscriptions/batch", 200],
                  ]).flat(),
            );
          },
          async verifyState() {
            expect(await stable()).toEqual(baseline);
            expect(
              await db.userSectionSubscription.findMany({
                orderBy: { sectionId: "asc" },
                select: { userId: true, sectionId: true, kind: true },
              }),
            ).toEqual(
              f.sections
                .map(({ id }) => ({
                  userId: f.owner.id,
                  sectionId: id,
                  kind: "regular",
                }))
                .sort((a, b) => a.sectionId - b.sectionId),
            );
            const finalSessions = await db.session.findMany();
            expect(finalSessions).toEqual(
              sessions.map((session) => ({
                ...session,
                expires: expect.any(Date),
                updatedAt: expect.any(Date),
              })),
            );
            const expiryClock =
              finalSessions[0].expires.getTime() - 30 * 86400_000;
            for (const time of [
              expiryClock,
              finalSessions[0].updatedAt.getTime(),
            ]) {
              expect(time).toBeGreaterThanOrEqual(sessionStarted);
              expect(time).toBeLessThanOrEqual(sessionFinished);
            }
            expect(finalSessions[0].updatedAt.getTime()).toBeGreaterThanOrEqual(
              expiryClock,
            );
            expect(finalSessions[0].expires.getTime()).toBeGreaterThan(
              sessions[0].expires.getTime(),
            );
            expect(
              await db.user.findMany({
                orderBy: { id: "asc" },
                select: { id: true, calendarFeedToken: true },
              }),
            ).toEqual(
              [f.owner, ...f.members]
                .sort((a, b) => a.id.localeCompare(b.id))
                .map(({ id }) => ({
                  id,
                  calendarFeedToken:
                    id === f.owner.id ? expect.any(String) : null,
                })),
            );
            expect(
              await db.auditLog.findMany({
                where: { action: "account_profile_update" },
                orderBy: { id: "asc" },
              }),
            ).toEqual(fixtureAudits);
            expect(
              await db.auditLog.findMany({
                where: { action: { not: "account_profile_update" } },
                select: {
                  action: true,
                  outcome: true,
                  channel: true,
                  userId: true,
                  subjectUserId: true,
                  targetId: true,
                  targetType: true,
                  oauthClientId: true,
                  oauthGrantId: true,
                  sessionId: true,
                  metadata: true,
                },
              }),
            ).toEqual([
              {
                action: "account_calendar_token_create",
                outcome: "success",
                channel: "system",
                userId: f.owner.id,
                subjectUserId: f.owner.id,
                targetId: f.owner.id,
                targetType: "calendar_feed",
                oauthClientId: null,
                oauthGrantId: null,
                sessionId: null,
                metadata: null,
              },
            ]);
            expect(await db.publication.count()).toBe(0);
            expect(await db.publicationRevision.count()).toBe(0);
            expect(await db.oAuthConsent.count()).toBe(0);
            expect(await db.oAuthRefreshToken.count()).toBe(0);
            expect(await db.oAuthAccessToken.count()).toBe(0);
            expect(await db.oAuthGrantUsageDaily.count()).toBe(0);
            expect(await db.deviceCode.count()).toBe(0);
            expect(await db.upload.count()).toBe(0);
            expect(await db.uploadPending.count()).toBe(0);
            expect(
              await createUploadBucket(request, baseURL).list({
                prefix: `uploads/${f.owner.id}/`,
              }),
            ).toEqual({ objects: [], truncated: false });
          },
        };
      },
      async (response, incoming) => {
        expect(incoming.method()).toBe("POST");
        expect([
          "/api/workspace/subscriptions/query",
          "/api/workspace/subscriptions/batch",
        ]).toContain(new URL(incoming.url()).pathname);
        expect(response.status()).toBe(200);
        const body = await response.json();
        if (new URL(incoming.url()).pathname.endsWith("/batch"))
          expect(body).toMatchObject({
            addedCount: count,
            removedCount: 0,
            unchangedCount: 0,
          });
      },
    );
  });
}
