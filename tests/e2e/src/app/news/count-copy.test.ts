import { expect } from "@playwright/test";
import {
  countCopyCheck,
  prepareCountObservation,
} from "../../../utils/localized-count-observation";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../api/mcp/_fixture";
import { createNewsCountFixture, setCountPublications } from "./count-fixture";

for (const count of [0, 1, 2]) {
  test(`news.localized-count-copy count=${count}`, {
    tag: "@Publication/Web",
  }, async ({ page, request, isolatedWorker, calendarProtocolRun }) => {
    test.setTimeout(300_000);
    const baseURL = isolatedWorker.origin;
    const db = isolatedWorker.database.owner;
    await calendarProtocolRun(async () => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const f = await db.$transaction((tx) =>
        createNewsCountFixture(tx, count),
      );

      const observation = await prepareCountObservation(
        isolatedWorker,
        request,
        undefined,
      );
      for (const locale of ["en-us", "zh-cn"]) {
        await setCountPublications(db, f, 0);
        await page.context().clearCookies();
        await page
          .context()
          .addCookies([{ name: "NEXT_LOCALE", value: locale, url: baseURL }]);
        const en = locale === "en-us";
        const check = countCopyCheck(locale, count);
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
      }
      return observation.checks({
        feedTokenCreated: false,
        subscriptions: [],
        writes: [],
      });
    });
  });
}
