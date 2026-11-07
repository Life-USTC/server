import { expect } from "@playwright/test";
import { test } from "../../../../utils/owned-page";
import {
  arrangeWeatherCache,
  readWeatherCache,
} from "../../../../utils/weather-cache-fixture";

for (const { locale, width } of [
  { locale: "en-us", width: 390 },
  { locale: "zh-cn", width: 1280 },
]) {
  test(
    `overview.home-weather-recovery ${locale} ${width}`,
    { tag: "@Overview/Web" },
    async ({ page, isolatedWorker, pageRun }, testInfo) => {
      const requests: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/_internal/home/"))
          requests.push(
            new URL(request.url()).pathname + new URL(request.url()).search,
          );
      });
      const observationsBefore =
        await isolatedWorker.database.owner.weatherObservation.findMany();
      await pageRun(
        async () => {
          await page.setViewportSize({ width, height: 1000 });
          await page
            .context()
            .addCookies([
              {
                name: "NEXT_LOCALE",
                value: locale,
                url: isolatedWorker.origin,
              },
            ]);
          await page.goto("/");
          const weather = page.getByTestId("home-weather");
          const retry = weather.getByRole("button", {
            name: locale === "en-us" ? "Retry weather" : "重试天气",
            exact: true,
          });
          await expect(retry).toBeVisible();
          await expect(page.getByTestId("home-campus-now")).toHaveAttribute(
            "aria-busy",
            "false",
          );
          await page.screenshot({
            path: testInfo.outputPath(`weather-cold-${locale}-${width}.png`),
            fullPage: true,
          });
          // This is the existing private Worker's real WEATHER KV arrangement
          // channel, reached after its actual cold read, without provider mocking.
          const snapshots = await arrangeWeatherCache(isolatedWorker.origin);
          const beforeRetry = requests.length;
          const retryResponse = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                "/_internal/home/campus-now" &&
              new URL(response.url()).searchParams.get("section") === "weather",
          );
          await retry.click();
          await expect(weather).toContainText("21°");
          await expect(weather).toContainText("17°");
          await expect(retry).toHaveCount(0);
          expect(requests.slice(beforeRetry)).toEqual([
            "/_internal/home/campus-now?section=weather",
          ]);
          expect((await retryResponse).headers()["cache-control"]).toContain(
            "no-store",
          );
          for (const snapshot of snapshots) {
            // The read must not rewrite either fetchedAt or any original source fact.
            expect(
              await readWeatherCache(
                isolatedWorker.origin,
                snapshot.location.key,
              ),
            ).toEqual(snapshot);
          }
          expect(
            await isolatedWorker.database.owner.weatherObservation.findMany(),
          ).toEqual(observationsBefore);
          await page.screenshot({
            path: testInfo.outputPath(
              `weather-recovered-${locale}-${width}.png`,
            ),
            fullPage: true,
          });
        },
        async (_response, request) => {
          throw new Error(
            `Unexpected business write: ${request.method()} ${request.url()}`,
          );
        },
      );
    },
  );
}
