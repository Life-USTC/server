import { expect, type Locator, type Page } from "@playwright/test";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../utils/page-ready";
import { courseNames, teacherNames, test } from "./mobile-catalog-fixture";

async function locale(
  page: Page,
  value: "zh-cn" | "en-us",
  headers: Record<string, string>,
) {
  expect(
    (
      await page.request.post("/api/account/preferences", {
        headers,
        data: { locale: value },
      })
    ).status(),
  ).toBe(200);
}
async function readableHeading(page: Page, name: string) {
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(name);
  await expect(heading).toBeInViewport();
  const geometry = await heading.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      fontSize: Number.parseFloat(style.fontSize),
      lineHeight: Number.parseFloat(style.lineHeight),
      height: rect.height,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      left: rect.left,
      right: rect.right,
      viewport: innerWidth,
    };
  });
  expect(geometry.fontSize).toBeGreaterThanOrEqual(24);
  expect(geometry.lineHeight).toBeGreaterThanOrEqual(geometry.fontSize);
  expect(geometry.height).toBeGreaterThanOrEqual(geometry.lineHeight - 1);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewport);
  await expectNoPageHorizontalOverflow(page);
}
async function reachable(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeInViewport();
}

test("course.mobile-detail-hierarchy", async ({
  page,
  mobile: { fixture, user },
  catalogSubscriptionRun,
}, testInfo) => {
  await catalogSubscriptionRun(
    user,
    { calendarMessages: [] },
    async (effects) => {
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        for (const language of ["zh-cn", "en-us"] as const) {
          await locale(page, language, effects.headers);
          await gotoAndWaitForReady(
            page,
            `/catalog/courses/${fixture.courses[0].jwId}`,
          );
          await readableHeading(
            page,
            language === "en-us"
              ? `${courseNames[language]} (${courseNames["zh-cn"]})`
              : courseNames[language],
          );
          const code = page.getByTestId("course-public-code");
          await expect(code).toHaveText("MATH-MOBILE-101");
          await expect(code).toBeInViewport();
          expect(
            await code.evaluate(
              (element) => getComputedStyle(element).fontFamily,
            ),
          ).toMatch(/mono/i);
          const offering = page.locator(
            `#sections a[href="/catalog/sections/${fixture.sections[0].jwId}"]:visible`,
          );
          await reachable(offering);
          await expect(offering).toContainText(teacherNames[language]);
          await expect(offering).toContainText(
            language === "zh-cn" ? "2026年秋季学期" : "Fall 2026",
          );
          await page.screenshot({
            path: testInfo.outputPath(`course-${language}-${width}.png`),
          });
          await offering.click();
          await expect(page).toHaveURL(
            new RegExp(`/catalog/sections/${fixture.sections[0].jwId}$`),
          );
        }
      }
    },
  );
});

test("teacher.mobile-detail-hierarchy", async ({
  page,
  mobile: { fixture, user },
  catalogSubscriptionRun,
}, testInfo) => {
  await catalogSubscriptionRun(
    user,
    { calendarMessages: [] },
    async (effects) => {
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        for (const language of ["zh-cn", "en-us"] as const) {
          await locale(page, language, effects.headers);
          await gotoAndWaitForReady(
            page,
            `/catalog/teachers/${fixture.teachers[0].id}`,
          );
          await readableHeading(
            page,
            language === "en-us"
              ? `${teacherNames[language]} (${teacherNames["zh-cn"]})`
              : teacherNames[language],
          );
          const department = page
            .locator("#main-content")
            .getByText(
              language === "zh-cn"
                ? fixture.departments[0].nameCn
                : (fixture.departments[0].nameEn ?? ""),
              { exact: true },
            );
          await reachable(department);
          const title = page
            .locator("#main-content")
            .getByText(
              language === "zh-cn"
                ? fixture.titles[0].nameCn
                : (fixture.titles[0].nameEn ?? ""),
              { exact: true },
            );
          await reachable(title);
          const offering = page.locator(
            `#sections a[href="/catalog/sections/${fixture.sections[0].jwId}"]:visible`,
          );
          await reachable(offering);
          await expect(offering).toContainText(courseNames[language]);
          await page.screenshot({
            path: testInfo.outputPath(`teacher-${language}-${width}.png`),
          });
          await offering.click();
          await expect(page).toHaveURL(
            new RegExp(`/catalog/sections/${fixture.sections[0].jwId}$`),
          );
        }
      }
    },
  );
});

test("section.mobile-detail-actions", async ({
  page,
  mobile: { fixture, user },
  catalogSubscriptionRun,
}, testInfo) => {
  await catalogSubscriptionRun(
    user,
    { calendarMessages: [] },
    async (effects) => {
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        for (const language of ["zh-cn", "en-us"] as const) {
          await locale(page, language, effects.headers);
          await gotoAndWaitForReady(
            page,
            `/catalog/sections/${fixture.sections[0].jwId}`,
          );
          await readableHeading(page, courseNames[language]);
          const overview = page.locator("#overview");
          const code = overview.getByText(fixture.sections[0].code, {
            exact: true,
          });
          await reachable(code);
          expect(
            await code.evaluate(
              (element) => getComputedStyle(element).fontFamily,
            ),
          ).toMatch(/mono/i);
          for (const value of ["3.5", "12 / 40", "32 / 32"])
            await reachable(overview.getByText(value, { exact: true }));
          await reachable(
            page.getByRole("definition").filter({
              hasText: language === "zh-cn" ? "2026年秋季学期" : "Fall 2026",
            }),
          );
          const teacher = page
            .locator("#main-content")
            .locator(`a[href="/catalog/teachers/${fixture.teachers[0].id}"]`)
            .first();
          await reachable(teacher);
          await expect(teacher).toContainText(teacherNames[language]);
          await expectNoPageHorizontalOverflow(page);
          await page.screenshot({
            path: testInfo.outputPath(`section-${language}-${width}.png`),
          });
          await teacher.click();
          await expect(page).toHaveURL(
            new RegExp(`/catalog/teachers/${fixture.teachers[0].id}$`),
          );
        }
      }
    },
  );
});

async function actionBarAboveNavigation(page: Page) {
  const bar = page.getByTestId("section-mobile-primary-actions");
  const navigation = page.locator('[data-shell-navigation="mobile-primary"]');
  await expect(bar).toBeInViewport();
  await expect(navigation).toBeInViewport();
  const barBox = await bar.boundingBox();
  const navBox = await navigation.boundingBox();
  if (!barBox || !navBox)
    throw new Error("Missing mobile action/navigation geometry");
  expect(barBox.y).toBeGreaterThanOrEqual(0);
  expect(barBox.y + barBox.height).toBeLessThanOrEqual(navBox.y + 1);
  for (const button of await bar.getByRole("button").all()) {
    await expect(button).toBeEnabled();
    await expect(button).toBeInViewport();
    expect(
      await button.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        );
        return hit !== null && element.contains(hit);
      }),
    ).toBe(true);
  }
  return bar;
}
test("section.mobile-sticky-actions", async ({
  page,
  mobile: { fixture, user },
  catalogSubscriptionRun,
  isolatedWorker,
  mobileDb,
}, testInfo) => {
  await catalogSubscriptionRun(
    user,
    {
      calendarMessages: Array.from({ length: 4 }, () => ({
        type: "user" as const,
        userId: user.id,
      })),
    },
    async (effects) => {
      await page
        .context()
        .addCookies([(await isolatedWorker.createSession(user.id)).cookie]);
      await locale(page, "zh-cn", effects.headers);
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await gotoAndWaitForReady(
          page,
          `/catalog/sections/${fixture.sections[0].jwId}`,
        );
        await actionBarAboveNavigation(page);
        await page.evaluate(() => {
          document
            .querySelectorAll("[data-detail-scroll-container]")
            .forEach((element) => {
              element.scrollTop = element.scrollHeight;
            });
          window.scrollTo(0, document.documentElement.scrollHeight);
        });
        const bar = await actionBarAboveNavigation(page);
        await page.screenshot({
          path: testInfo.outputPath(`sticky-actions-${width}.png`),
        });
        await bar
          .getByRole("button", { name: "添加到日历", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await bar
          .getByRole("button", { name: "订阅教学班", exact: true })
          .click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await dialog
          .getByRole("button", { name: "订阅教学班", exact: true })
          .click();
        await expect(
          bar.getByRole("button", { name: "取消订阅", exact: true }),
        ).toBeVisible();
        await expect
          .poll(() =>
            mobileDb((db) =>
              db.userSectionSubscription.count({
                where: { userId: user.id, sectionId: fixture.sections[0].id },
              }),
            ),
          )
          .toBe(1);
        await bar
          .getByRole("button", { name: "取消订阅", exact: true })
          .click();
        await expect(
          bar.getByRole("button", { name: "订阅教学班", exact: true }),
        ).toBeVisible();
        await expect
          .poll(() =>
            mobileDb((db) =>
              db.userSectionSubscription.count({
                where: { userId: user.id, sectionId: fixture.sections[0].id },
              }),
            ),
          )
          .toBe(0);
      }
    },
  );
});
