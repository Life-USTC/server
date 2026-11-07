import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test } from "../../../../utils/personal-preferences-fixture";

const lecture =
  "Concrete lecture / 具体讲座 QuantumMaterialsWithoutWhitespaceABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
for (const locale of ["en-us", "zh-cn"] as const) {
  for (const width of [1280, 390]) {
    test(
      `overview activity ranges ${locale} ${width}`,
      { tag: "@Overview/Web" },
      async ({ page, isolatedWorker, preferenceFlow }, testInfo) => {
        await preferenceFlow.prepare(() =>
          isolatedWorker.database.owner.youngEvent.createMany({
            data: [
              ...Array.from({ length: 6 }, (_, i) => ({
                youngId: `range-${i}`,
                name: `Future semester range ${i} / 未来跨学期活动`,
                startAt: new Date(`2029-08-${24 + i}T06:25:00Z`),
                endAt: new Date("2030-01-15T06:25:00Z"),
                location: "East campus concert hall / 东校区音乐厅",
                isActive: true,
                rawJson: {},
              })),
              {
                youngId: "lecture",
                name: lecture,
                startAt: new Date("2029-11-05T06:00:00Z"),
                endAt: new Date("2029-11-05T08:00:00Z"),
                location: "West campus lecture hall / 西校区报告厅",
                isActive: true,
                rawJson: {},
              },
              {
                youngId: "start-only",
                name: "Start known / 已知开始时间",
                startAt: new Date("2029-11-06T06:00:00Z"),
                endAt: null,
                isActive: true,
                rawJson: {},
              },
            ],
          }),
        );
        const before = await preferenceFlow.prepare(() =>
          isolatedWorker.database.owner.youngEvent.findMany({
            orderBy: { youngId: "asc" },
          }),
        );
        await preferenceFlow.run(async () => {
          await page.setViewportSize({ width, height: 1000 });
          await page.context().addCookies([
            {
              name: "NEXT_LOCALE",
              value: locale,
              url: isolatedWorker.origin,
            },
          ]);
          await gotoAndWaitForReady(page, "/");
          const activities = page.getByTestId("home-activities");
          const upcoming = activities
            .locator("h3")
            .filter({
              hasText:
                locale === "en-us" ? "Today and upcoming" : "今日及后续活动",
            })
            .locator("..");
          const ranges = activities
            .locator("h3")
            .filter({
              hasText: locale === "en-us" ? "Multi-day activities" : "跨日活动",
            })
            .locator("..");
          await expect(upcoming.getByRole("link")).toHaveCount(2);
          await expect(upcoming.getByRole("link").first()).toHaveAttribute(
            "href",
            "/catalog/young-events/lecture",
          );
          await expect(
            upcoming.locator('[data-slot="item-title"]').first(),
          ).toHaveText(lecture);
          await expect(upcoming.getByRole("link").first()).toContainText(
            "2029-11-05 14:00–16:00",
          );
          await expect(upcoming.getByRole("link").nth(1)).toContainText(
            locale === "en-us"
              ? "Starts: 2029-11-06 14:00"
              : "开始：2029-11-06 14:00",
          );
          await expect(ranges.locator("a")).toHaveCount(5);
          await expect(
            ranges.getByRole("link").filter({ visible: true }),
          ).toHaveCount(width === 1280 ? 5 : 3);
          expect(
            await ranges
              .locator("a")
              .evaluateAll((nodes) =>
                nodes.map((node) => node.getAttribute("href")),
              ),
          ).toEqual(
            Array.from(
              { length: 5 },
              (_, i) => `/catalog/young-events/range-${i}`,
            ),
          );
          for (let i = 0; i < (width === 1280 ? 5 : 3); i++) {
            await expect(ranges.getByRole("link").nth(i)).toContainText(
              `2029-08-${24 + i} 14:25 – 2030-01-15 14:25`,
            );
          }
          expect(
            await upcoming
              .locator('[data-slot="item-description"]')
              .first()
              .evaluate((node) => {
                const style = getComputedStyle(node);
                return {
                  display: style.display,
                  direction: style.flexDirection,
                };
              }),
          ).toEqual({ display: "flex", direction: "column" });
          // Prove complete title and date text fits its actual visible container.
          // Root no-overflow alone cannot catch a clipped activity range.
          const geometry = await activities
            .locator('[data-slot="item-title"], [data-slot="item-description"]')
            .evaluateAll((nodes) =>
              nodes
                .filter((node) => node.getBoundingClientRect().height > 0)
                .map((node) => {
                  const element = node as HTMLElement;
                  const bounds = element.getBoundingClientRect();
                  const range = document.createRange();
                  range.selectNodeContents(element);
                  return {
                    text: element.textContent,
                    clipped:
                      element.scrollHeight > element.clientHeight + 1 ||
                      element.scrollWidth > element.clientWidth + 1,
                    outside: [...range.getClientRects()].some(
                      (rect) =>
                        rect.left < bounds.left - 1 ||
                        rect.right > bounds.right + 1 ||
                        rect.top < bounds.top - 1 ||
                        rect.bottom > bounds.bottom + 1,
                    ),
                  };
                }),
            );
          expect(geometry.length).toBeGreaterThanOrEqual(10);
          expect(geometry.every((item) => !item.clipped && !item.outside)).toBe(
            true,
          );
          await page.evaluate(() => document.fonts.ready);
          await activities.screenshot({
            path: testInfo.outputPath(`${locale}-${width}.png`),
          });
          expect(
            await isolatedWorker.database.owner.youngEvent.findMany({
              orderBy: { youngId: "asc" },
            }),
          ).toEqual(before);
        });
      },
    );
  }
}
