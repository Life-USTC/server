import { readFile } from "node:fs/promises";
import { expect } from "@playwright/test";
import { test } from "../../../utils/owned-worker";

for (const locale of ["en-us", "zh-cn"] as const) {
  for (const width of [390, 1280]) {
    test(
      `detail.modules remain independent while introduction loads ${locale} ${width}`,
      {
        tag: "@Section/Web",
      },
      async ({ page, isolatedWorker, run }, testInfo) => {
        await run(async () => {
          const jwId = 1_800_000_000 + Math.floor(Math.random() * 100_000_000);
          const course = await isolatedWorker.database.owner.course.create({
            data: {
              jwId,
              code: "MODULE-COURSE",
              nameCn: "独立模块测试课程",
              nameEn: "Independent module course",
            },
          });
          const section = await isolatedWorker.database.owner.section.create({
            data: {
              jwId: jwId + 1,
              code: "MODULE-SECTION",
              courseId: course.id,
            },
          });
          await page.context().addCookies([
            {
              name: "NEXT_LOCALE",
              value: locale,
              url: isolatedWorker.origin,
            },
          ]);
          await page.setViewportSize({ width, height: 900 });
          const manifest = JSON.parse(
            await readFile(
              ".svelte-kit/output/client/.vite/manifest.json",
              "utf8",
            ),
          );
          const chunk =
            manifest[
              "src/features/descriptions/components/DescriptionCard.svelte"
            ].file;
          let release!: () => void;
          const gate = new Promise<void>((resolve) => {
            release = resolve;
          });
          let observed!: () => void;
          const requested = new Promise<void>((resolve) => {
            observed = resolve;
          });
          await page.route(`**/${chunk}`, async (route) => {
            observed();
            await gate;
            await route.continue();
          });
          try {
            await page.goto(`/catalog/sections/${section.jwId}`, {
              waitUntil: "domcontentloaded",
            });
            await requested;
            await page.screenshot({
              path: testInfo.outputPath(`loading-${locale}-${width}.png`),
              fullPage: true,
            });
            await expect(page.locator("#introduction h2")).toHaveText(
              locale === "en-us" ? "Description" : "简介",
            );
            await expect(
              page.locator("#calendar [data-slot=empty]"),
            ).toBeVisible();
            await expect(
              page.locator("#exams [data-slot=empty]"),
            ).toBeVisible();
            await expect(
              page.locator("#homework [data-slot=empty]"),
            ).toBeVisible();
            await expect(page.locator("#comments h2")).toBeVisible();
            await expect(
              page.locator("#comments [aria-busy=true]"),
            ).toHaveCount(0);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
          } finally {
            release();
          }
          await expect(
            page.locator("#introduction [aria-busy=true]"),
          ).toHaveCount(0);
          await expect(page.locator("#introduction h2")).toHaveCount(1);
          await page.screenshot({
            path: testInfo.outputPath(`ready-${locale}-${width}.png`),
            fullPage: true,
          });
        });
      },
    );
  }
}

for (const locale of ["en-us", "zh-cn"] as const) {
  for (const width of [390, 1280]) {
    test(
      `detail.poster retains geometry while image loads ${locale} ${width}`,
      {
        tag: "@Young/Web",
      },
      async ({ page, isolatedWorker, run }, testInfo) => {
        await run(async () => {
          const youngId = `poster-${crypto.randomUUID()}`;
          const imageUrl = "group1/detail-poster.jpg";
          await isolatedWorker.database.owner.youngEvent.create({
            data: {
              youngId,
              name: "Activity poster layout fixture",
              imageUrl,
              isActive: true,
              rawJson: {},
            },
          });
          await page.context().addCookies([
            {
              name: "NEXT_LOCALE",
              value: locale,
              url: isolatedWorker.origin,
            },
          ]);
          await page.setViewportSize({ width, height: 900 });
          let release!: () => void;
          const gate = new Promise<void>((resolve) => {
            release = resolve;
          });
          let observed!: () => void;
          const requested = new Promise<void>((resolve) => {
            observed = resolve;
          });
          await page.route(
            "**/api/catalog/young-events/images/group1/detail-poster.jpg",
            async (route) => {
              observed();
              await gate;
              await route.fulfill({
                contentType: "image/svg+xml",
                body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#c5e7eb"/><text x="60" y="160" font-size="55">Activity poster</text></svg>',
              });
            },
          );
          try {
            await page.goto(`/catalog/young-events/${youngId}`, {
              waitUntil: "domcontentloaded",
            });
            await requested;
            await page.waitForFunction(
              () =>
                document.documentElement.dataset.lifeUstcHydrated === "true",
            );
            const banner = page.getByTestId("young-event-banner");
            const loading = await banner.boundingBox();
            await page.screenshot({
              path: testInfo.outputPath(
                `poster-loading-${locale}-${width}.png`,
              ),
              fullPage: true,
            });
            release();
            const image = banner.locator("img");
            await expect(image).toHaveJSProperty("naturalWidth", 800);
            const ready = await banner.boundingBox();
            await page.screenshot({
              path: testInfo.outputPath(`poster-ready-${locale}-${width}.png`),
              fullPage: true,
            });
            expect(loading).not.toBeNull();
            expect(ready).not.toBeNull();
            if (!ready || !loading)
              throw new Error("Poster banner requires geometry");
            expect(Math.abs(ready.height - loading.height)).toBeLessThan(1);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
          } finally {
            release();
          }
        });
      },
    );
  }
}

for (const [locale, width] of [
  ["en-us", 390],
  ["zh-cn", 1280],
] as const) {
  test(
    `detail.module failure recovers locally ${locale} ${width}`,
    {
      tag: "@Section/Web",
    },
    async ({ page, isolatedWorker, run }, testInfo) => {
      await run(async () => {
        const jwId = 1_800_000_000 + Math.floor(Math.random() * 100_000_000);
        const course = await isolatedWorker.database.owner.course.create({
          data: {
            jwId,
            code: "RECOVER-COURSE",
            nameCn: "局部恢复测试课程",
            nameEn: "Local recovery course",
          },
        });
        const section = await isolatedWorker.database.owner.section.create({
          data: {
            jwId: jwId + 1,
            code: "RECOVER-SECTION",
            courseId: course.id,
          },
        });
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        await page.setViewportSize({ width, height: 900 });
        const manifest = JSON.parse(
          await readFile(
            ".svelte-kit/output/client/.vite/manifest.json",
            "utf8",
          ),
        );
        const chunk =
          manifest[
            "src/features/section-detail/components/SectionCalendarTab.svelte"
          ].file;
        let requests = 0;
        let recovering = false;
        await page.route(`**/${chunk}`, async (route) => {
          requests += 1;
          if (!recovering) await route.abort("failed");
          else await route.continue();
        });
        const uncaught: string[] = [];
        page.on("pageerror", (error) => uncaught.push(error.message));
        let navigations = 0;
        page.on("framenavigated", (frame) => {
          if (frame === page.mainFrame()) navigations += 1;
        });
        await page.goto(`/catalog/sections/${section.jwId}`, {
          waitUntil: "domcontentloaded",
        });
        const calendar = page.locator("#calendar");
        await expect(calendar.getByRole("alert")).toBeVisible();
        await expect(page.locator("#exams [data-slot=empty]")).toBeVisible();
        await expect(page.locator("#homework [data-slot=empty]")).toBeVisible();
        await expect(page.locator("#comments h2")).toBeVisible();
        await page.screenshot({
          path: testInfo.outputPath(`module-error-${locale}-${width}.png`),
          fullPage: true,
        });
        const initialNavigations = navigations;
        const initialRequests = requests;
        recovering = true;
        await calendar
          .getByRole("button", {
            name: locale === "en-us" ? "Please retry" : "请重试",
          })
          .click();
        await expect(calendar.getByRole("alert")).toHaveCount(0);
        await expect(calendar.locator("[data-slot=empty]")).toBeVisible();
        expect(requests).toBeGreaterThan(initialRequests);
        expect(navigations).toBe(initialNavigations);
        expect(uncaught).toEqual([]);
        await page.screenshot({
          path: testInfo.outputPath(`module-recovered-${locale}-${width}.png`),
          fullPage: true,
        });
      });
    },
  );

  test(
    `detail.poster failure recovers in its reserved frame ${locale} ${width}`,
    {
      tag: "@Young/Web",
    },
    async ({ page, isolatedWorker, run }, testInfo) => {
      await run(async () => {
        const youngId = `poster-recovery-${crypto.randomUUID()}`;
        await isolatedWorker.database.owner.youngEvent.create({
          data: {
            youngId,
            name: "Poster recovery fixture",
            imageUrl: "group1/recovery-poster.jpg",
            isActive: true,
            rawJson: {},
          },
        });
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        await page.setViewportSize({ width, height: 900 });
        let requests = 0;
        await page.route(
          "**/api/catalog/young-events/images/group1/recovery-poster.jpg",
          async (route) => {
            requests += 1;
            if (requests === 1)
              await route.fulfill({ status: 503, body: "Unavailable" });
            else
              await route.fulfill({
                contentType: "image/svg+xml",
                body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#c5e7eb"/></svg>',
              });
          },
        );
        await page.goto(`/catalog/young-events/${youngId}`, {
          waitUntil: "domcontentloaded",
        });
        const poster = page.getByTestId("young-event-poster");
        await expect(poster.getByRole("alert")).toBeVisible();
        const failed = await poster.boundingBox();
        await expect(poster.getByRole("link")).toHaveAttribute(
          "href",
          "/api/catalog/young-events/images/group1/recovery-poster.jpg",
        );
        await page.screenshot({
          path: testInfo.outputPath(`poster-error-${locale}-${width}.png`),
          fullPage: true,
        });
        await poster
          .getByRole("button", {
            name: locale === "en-us" ? "Retry" : "重试",
            exact: true,
          })
          .click();
        await expect(poster.locator("img")).toHaveJSProperty(
          "naturalWidth",
          800,
        );
        await expect(poster.getByRole("alert")).toHaveCount(0);
        const recovered = await poster.boundingBox();
        if (!failed || !recovered)
          throw new Error("Poster requires reserved frame geometry");
        expect(Math.abs(failed.height - recovered.height)).toBeLessThan(1);
        expect(requests).toBe(2);
        await page.screenshot({
          path: testInfo.outputPath(`poster-recovered-${locale}-${width}.png`),
          fullPage: true,
        });
      });
    },
  );
}
