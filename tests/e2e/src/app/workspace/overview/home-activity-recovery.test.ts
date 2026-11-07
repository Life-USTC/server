import { expect } from "@playwright/test";
import pg from "pg";
import { test } from "../../../../utils/owned-page";

for (const { locale, width } of [
  { locale: "en-us", width: 390 },
  { locale: "zh-cn", width: 1280 },
]) {
  test(
    `overview.home-activity-recovery ${locale} ${width}`,
    { tag: "@Overview/Web" },
    async ({ page, isolatedWorker, pageRun, run }, testInfo) => {
      test.setTimeout(120_000);
      const dateKey = new Date(Date.now() + 8 * 3600000)
        .toISOString()
        .slice(0, 10);
      const event = await run(() =>
        isolatedWorker.database.owner.youngEvent.create({
          data: {
            youngId: "home-recovery-activity",
            name: "Campus recovery activity",
            startAt: new Date(`${dateKey}T12:00:00+08:00`),
            endAt: new Date(`${dateKey}T13:00:00+08:00`),
            isActive: true,
            rawJson: {},
          },
        }),
      );
      const client = new pg.Client({
        connectionString: isolatedWorker.database.connections.owner,
      });
      await client.connect();
      let revoked = false;
      const requests: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/_internal/home/"))
          requests.push(
            new URL(request.url()).pathname + new URL(request.url()).search,
          );
      });
      try {
        await client.query(
          'REVOKE SELECT ON "YoungEvent" FROM life_ustc_runtime',
        );
        revoked = true;
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
            expect(response?.headers()["x-life-public-ssr-degraded"]).toBe("1");
            const activities = page.getByTestId("home-activities");
            const retry = activities.getByRole("button", {
              name: locale === "en-us" ? "Retry activities" : "重试活动",
              exact: true,
            });
            await expect(retry).toBeVisible();
            await expect(page.getByTestId("home-campus-now")).toHaveAttribute(
              "aria-busy",
              "false",
            );
            await expect(
              activities.locator('a[href="/catalog/young-events"]'),
            ).toBeVisible();
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
            await page.screenshot({
              path: testInfo.outputPath(
                `activity-degraded-${locale}-${width}.png`,
              ),
              fullPage: true,
            });
            await client.query(
              'GRANT SELECT ON "YoungEvent" TO life_ustc_runtime',
            );
            revoked = false;
            const beforeRetry = requests.length;
            const retryResponse = page.waitForResponse(
              (response) =>
                new URL(response.url()).pathname ===
                "/_internal/home/activities",
            );
            await retry.click();
            await expect(
              activities.getByRole("link", {
                name: /Campus recovery activity/,
              }),
            ).toBeVisible();
            expect(requests.slice(beforeRetry)).toEqual([
              "/_internal/home/activities",
            ]);
            expect((await retryResponse).headers()["cache-control"]).toContain(
              "no-store",
            );
            expect(
              await isolatedWorker.database.owner.youngEvent.findUniqueOrThrow({
                where: { youngId: event.youngId },
              }),
            ).toEqual(event);
            await page.screenshot({
              path: testInfo.outputPath(
                `activity-recovered-${locale}-${width}.png`,
              ),
              fullPage: true,
            });
            await activities
              .getByRole("link", { name: /Campus recovery activity/ })
              .click();
            await expect(page).toHaveURL(
              /\/catalog\/young-events\/home-recovery-activity$/,
            );
          },
          async (_response, request) => {
            throw new Error(
              `Unexpected business write: ${request.method()} ${request.url()}`,
            );
          },
        );
      } finally {
        if (revoked)
          await client.query(
            'GRANT SELECT ON "YoungEvent" TO life_ustc_runtime',
          );
        await client.end();
      }
    },
  );
}
