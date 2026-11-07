import { expect } from "@playwright/test";
import pg from "pg";
import type { HomeCampusNow } from "@/features/workspace/server/anonymous-home-sections";
import { arrangeBusTimetable } from "../../../../../shared/bus-timetable";
import { observeAction } from "../../../../utils/observed-action";
import { test } from "../../../../utils/owned-page";
import { expectNoPageHorizontalOverflow } from "../../../../utils/page-ready";

for (const locale of ["en-us", "zh-cn"]) {
  for (const width of [1280, 390]) {
    test(
      `overview.home-section-recovery ${locale} ${width}`,
      { tag: "@Overview/Web" },
      async ({ page, isolatedWorker, pageRun, run }, testInfo) => {
        test.setTimeout(120_000);
        await run(async () => {
          const db = isolatedWorker.database.owner;
          await db.publicationSource.create({
            data: { id: "home-recovery", name: "Campus" },
          });
          const publication = await db.publication.create({
            data: {
              id: "home-recovery-notice",
              sourceId: "home-recovery",
              canonicalUrl: "https://example.test/home-recovery-notice",
              title: "Campus notice",
              publicationType: "notice",
              publishedAt: new Date("2026-11-03T01:00:00Z"),
            },
          });
          const revision = await db.publicationRevision.create({
            data: {
              publicationId: publication.id,
              revisionHash: "home-recovery".padEnd(64, "0"),
              observedAt: new Date("2026-11-03T02:00:00Z"),
              title: "Campus notice",
              publicationType: "notice",
              publishedAt: publication.publishedAt,
            },
          });
          await db.publication.update({
            where: { id: publication.id },
            data: { currentRevisionId: revision.id },
          });
          await arrangeBusTimetable(db);
        });
        const publicationsBefore =
          await isolatedWorker.database.owner.publication.findMany();
        const revisionsBefore =
          await isolatedWorker.database.owner.publicationRevision.findMany();
        const pageErrors: string[] = [];
        const sectionRequests: string[] = [];
        page.on("request", (request) => {
          if (request.url().includes("/_internal/home/"))
            sectionRequests.push(
              new URL(request.url()).pathname + new URL(request.url()).search,
            );
        });
        page.on("pageerror", (error) => pageErrors.push(error.message));
        const lock = new pg.Client({
          connectionString: isolatedWorker.database.connections.owner,
        });
        await lock.connect();
        let locked = false;
        let busRevoked = false;
        let publicationRevoked = false;
        try {
          await lock.query("BEGIN");
          await lock.query('LOCK TABLE "Publication" IN ACCESS EXCLUSIVE MODE');
          locked = true;
          await pageRun(
            async () => {
              await page.setViewportSize({ width, height: 1000 });
              await page.context().addCookies([
                {
                  name: "NEXT_LOCALE",
                  value: locale,
                  url: isolatedWorker.origin,
                },
              ]);
              const response = await page.goto("/");
              expect(response?.status()).toBe(200);
              expect(response?.headers()["cache-control"]).toContain(
                "no-store",
              );
              expect(response?.headers()["x-life-public-ssr-degraded"]).toBe(
                "1",
              );
              const notices = page.getByTestId("home-notices");
              const retry = notices.getByRole("button", {
                name: locale === "en-us" ? "Retry notices" : "重试通知",
                exact: true,
              });
              await expect(retry).toBeVisible();
              await expect(
                notices.getByRole("link", {
                  name:
                    locale === "en-us"
                      ? "All news and notices"
                      : "全部新闻与通知",
                }),
              ).toHaveAttribute("href", "/news");
              const blocked = await lock.query<{ count: string }>(
                `SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%Publication%' AND pid <> pg_backend_pid()`,
              );
              expect(Number(blocked.rows[0]?.count)).toBeGreaterThan(0);
              await expect
                .poll(() =>
                  isolatedWorker.database.owner.runtimeIssueEvent.count({
                    where: {
                      event: "home.section.degraded",
                      requestId: response?.headers()["x-request-id"],
                    },
                  }),
                )
                .toBeGreaterThan(0);
              await expect(page.getByTestId("home-campus-now")).toHaveAttribute(
                "aria-busy",
                "false",
              );
              await page.screenshot({
                path: testInfo.outputPath(`degraded-${locale}-${width}.png`),
                fullPage: true,
              });
              await lock.query("ROLLBACK");
              locked = false;
              const beforeNoticeRetry = sectionRequests.length;
              await retry.click();
              await expect(
                notices.getByRole("link", { name: "Campus notice" }),
              ).toBeVisible();
              await expect(retry).toHaveCount(0);
              expect(sectionRequests.slice(beforeNoticeRetry)).toEqual([
                "/_internal/home/notices",
              ]);
              const noticeResponse = await page.request.get(
                "/_internal/home/notices",
              );
              expect(noticeResponse.headers()["cache-control"]).toContain(
                "no-store",
              );
              expect((await noticeResponse.json()).notices[0].key).toBe(
                "home-recovery-notice",
              );
              await page.screenshot({
                path: testInfo.outputPath(`recovered-${locale}-${width}.png`),
                fullPage: true,
              });
              await expectNoPageHorizontalOverflow(page);

              // A genuine database permission exception also degrades, and the
              // same module button recovers after its permission is restored.
              await lock.query(
                'REVOKE SELECT ON "Publication" FROM life_ustc_runtime',
              );
              publicationRevoked = true;
              await page.reload();
              await expect(retry).toBeVisible();
              await expect
                .poll(() =>
                  isolatedWorker.database.owner.runtimeIssueEvent.count({
                    where: { event: "home.section.degraded" },
                  }),
                )
                .toBeGreaterThan(1);
              await lock.query(
                'GRANT SELECT ON "Publication" TO life_ustc_runtime',
              );
              publicationRevoked = false;
              await retry.click();
              await expect(
                notices.getByRole("link", { name: "Campus notice" }),
              ).toBeVisible();
              await notices
                .getByRole("link", { name: "Campus notice" })
                .click();
              await expect(page).toHaveURL(/\/news\/home-recovery-notice$/);

              // Cold runtime bus read, then restored data, through the native UI.
              // The no-store endpoint and section query keep the other module out.
              await lock.query(
                'REVOKE SELECT ON "BusScheduleVersion" FROM life_ustc_runtime',
              );
              busRevoked = true;
              const failedBus = await page.request.get(
                "/_internal/home/campus-now?section=bus",
              );
              expect(failedBus.headers()["cache-control"]).toContain(
                "no-store",
              );
              expect((await failedBus.json()).bus).toBeNull();
              await page.goto("/");
              const busRetry = page
                .getByTestId("home-bus")
                .getByRole("button", {
                  name: locale === "en-us" ? "Retry departures" : "重试班次",
                  exact: true,
                });
              await expect(busRetry).toBeVisible();
              await lock.query(
                'GRANT SELECT ON "BusScheduleVersion" TO life_ustc_runtime',
              );
              busRevoked = false;
              const beforeBusRetry = sectionRequests.length;
              const busRetryStartedAt = Date.now();
              const busResponse = await observeAction(
                () =>
                  page.waitForResponse((response) => {
                    const url = new URL(response.url());
                    return (
                      url.pathname === "/_internal/home/campus-now" &&
                      url.searchParams.get("section") === "bus" &&
                      response.request().method() === "GET" &&
                      response.status() === 200
                    );
                  }),
                () => busRetry.click(),
              );
              await expect(busRetry).toHaveCount(0);
              expect(sectionRequests.slice(beforeBusRetry)).toEqual([
                "/_internal/home/campus-now?section=bus",
              ]);
              const recoveredCampus: HomeCampusNow = await busResponse.json();
              expect(recoveredCampus.bus).not.toBeNull();
              if (!recoveredCampus.bus)
                throw new Error("Bus retry did not recover");
              const recoveredBus = recoveredCampus.bus;
              const dateFormat = new Intl.DateTimeFormat(locale, {
                timeZone: "Asia/Shanghai",
                dateStyle: "short",
              });
              const serviceDates = [busRetryStartedAt, Date.now()].map((at) =>
                dateFormat.format(new Date(at)),
              );
              expect(
                serviceDates.some((date) =>
                  recoveredBus.originNote.includes(date),
                ),
              ).toBe(true);
              expect(recoveredBus.originNote).toMatch(
                locale === "en-us" ? /^Today \(/ : /^今天（/,
              );
              await expect(page.getByTestId("home-bus")).toContainText(
                recoveredBus.departures.length === 0
                  ? recoveredBus.emptyNote
                  : recoveredBus.originNote,
              );
              await expect(
                page
                  .getByTestId("home-notices")
                  .getByRole("link", { name: "Campus notice" }),
              ).toBeVisible();
              expect(
                await isolatedWorker.database.owner.publication.findMany(),
              ).toEqual(publicationsBefore);
              expect(
                await isolatedWorker.database.owner.publicationRevision.findMany(),
              ).toEqual(revisionsBefore);
              expect(pageErrors).toEqual([]);
            },
            async (_response, request) => {
              throw new Error(
                `Unexpected business write: ${request.method()} ${request.url()}`,
              );
            },
          );
        } finally {
          if (locked) await lock.query("ROLLBACK");
          if (publicationRevoked)
            await lock.query(
              'GRANT SELECT ON "Publication" TO life_ustc_runtime',
            );
          if (busRevoked)
            await lock.query(
              'GRANT SELECT ON "BusScheduleVersion" TO life_ustc_runtime',
            );
          await lock.end();
        }
      },
    );
  }
}
