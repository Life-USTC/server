import { expect, type Locator, type Page } from "@playwright/test";
import { createCatalogContractFixture } from "../../../../shared/catalog-contract-fixture";
import { test } from "../../../utils/catalog-subscription-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

function requiredText(value: string | null) {
  if (!value) throw new Error("Expected nonempty isolated fixture fact");
  return value;
}
async function bounds(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected rendered catalog information bounds");
  return box;
}
async function reachable(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeInViewport();
}

async function createFactsFixture(
  db: Parameters<typeof createCatalogContractFixture>[0],
) {
  const fixture = await createCatalogContractFixture(db);
  const { user, classType, courseType } = await db.$transaction(async (db) => {
    await db.semester.update({
      where: { id: fixture.semester.id },
      data: { nameCn: "2026年秋季学期" },
    });
    const classType = await db.classType.create({
      data: {
        nameCn: `分类${fixture.marker}`,
        nameEn: `Class ${fixture.marker}`,
      },
    });
    const courseType = await db.courseType.create({
      data: {
        nameCn: `类型${fixture.marker}`,
        nameEn: `Type ${fixture.marker}`,
      },
    });
    await db.course.update({
      where: { id: fixture.courses[0].id },
      data: { classTypeId: classType.id, typeId: courseType.id },
    });
    // Teacher URLs use internal IDs; make the cache key unique across fresh databases.
    fixture.teachers[0] = await db.teacher.update({
      where: { id: fixture.teachers[0].id },
      data: { id: fixture.base + 50 },
    });
    await db.section.update({
      where: { id: fixture.sections[0].id },
      data: {
        credits: 3.5,
        period: 32,
        actualPeriods: 30,
        stdCount: 12,
        limitCount: 40,
      },
    });
    const user = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `${fixture.marker}@example.test`,
        name: "Catalog facts viewer",
        username: fixture.marker,
      },
    });
    return { user, classType, courseType };
  });
  return { fixture, user, classType, courseType };
}

async function detailColumns(page: Page, width: number) {
  const main = page.locator("#main-content");
  const identity = main.locator("[data-detail-identity]");
  const aside = main.locator("aside");
  const reading = main.locator("[data-detail-reading-stream]");
  await expect(identity).toHaveCount(1);
  await expect(aside).toHaveCount(1);
  if (width === 1280) {
    const boxes = await Promise.all([identity, aside, reading].map(bounds));
    expect(boxes[0].x).toBeGreaterThan(boxes[2].x + boxes[2].width);
    expect(boxes[1].x).toBe(boxes[0].x);
  }
  return { main, identity, aside };
}

test("ui.detail-two-column-stream-4 Section", { tag: "@Section/Web" }, async ({
  page,
  isolatedWorker,
  run,
  catalogSubscriptionRun,
}) => {
  test.setTimeout(90_000);
  const db = isolatedWorker.database.owner;
  const { fixture, user } = await run(() => createFactsFixture(db));
  await catalogSubscriptionRun(
    user,
    {
      calendarMessages: [],
    },
    async () => {
      await page.context().clearCookies();
      await page
        .context()
        .addCookies([
          (await isolatedWorker.createSession(user.id)).cookie,
          { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
        ]);
      const section = fixture.sections[0];
      const teacher = fixture.teachers[0];
      for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        const id = section.jwId;
        await gotoAndWaitForReady(page, `/catalog/sections/${id}`);
        const { identity, aside } = await detailColumns(page, width);
        await reachable(
          identity.getByRole("definition").filter({ hasText: "Fall 2026" }),
        );
        const teacherLink = identity.getByRole("link", {
          name: teacher.nameEn ?? teacher.nameCn,
        });
        await reachable(teacherLink);
        await expect(teacherLink).toHaveAttribute(
          "href",
          `/catalog/teachers/${teacher.id}`,
        );
        for (const text of [section.code, "3.5", "12 / 40", "32 / 30"])
          await reachable(
            aside.getByRole("definition").filter({ hasText: text }),
          );
        await teacherLink.click();
        await expect(page).toHaveURL(
          new RegExp(`/catalog/teachers/${teacher.id}$`),
        );
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          teacher.nameEn ?? teacher.nameCn,
        );
        await gotoAndWaitForReady(page, `/catalog/sections/${section.jwId}`);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
    },
  );
});

test("ui.detail-two-column-stream-4 Course", { tag: "@Course/Web" }, async ({
  page,
  isolatedWorker,
  run,
  catalogSubscriptionRun,
}) => {
  test.setTimeout(90_000);
  const db = isolatedWorker.database.owner;
  const { fixture, user, classType, courseType } = await run(() =>
    createFactsFixture(db),
  );
  await catalogSubscriptionRun(
    user,
    {
      calendarMessages: [],
    },
    async () => {
      await page.context().clearCookies();
      await page
        .context()
        .addCookies([
          (await isolatedWorker.createSession(user.id)).cookie,
          { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
        ]);
      const section = fixture.sections[0];
      for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        const id = fixture.courses[0].jwId;
        await gotoAndWaitForReady(page, `/catalog/courses/${id}`);
        const { main, aside } = await detailColumns(page, width);
        const expectedFacts = [
          requiredText(classType.nameEn),
          requiredText(courseType.nameEn),
        ];
        for (const text of expectedFacts)
          await reachable(
            aside.getByRole("definition").filter({ hasText: text }),
          );
        await expect(
          main.getByRole("button", {
            name: /^(Subscribe to section|Unsubscribe from section|Add to Calendar)$/,
          }),
        ).toHaveCount(0);
        const offering = main
          .locator(
            `#sections a[href="/catalog/sections/${section.jwId}"]:visible`,
          )
          .first();
        await reachable(offering);
        await offering.click();
        await expect(page).toHaveURL(
          new RegExp(`/catalog/sections/${section.jwId}$`),
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
    },
  );
});

test("ui.detail-two-column-stream-4 Teacher", { tag: "@Teacher/Web" }, async ({
  page,
  isolatedWorker,
  run,
  catalogSubscriptionRun,
}) => {
  test.setTimeout(90_000);
  const db = isolatedWorker.database.owner;
  const { fixture, user } = await run(() => createFactsFixture(db));
  await catalogSubscriptionRun(
    user,
    {
      calendarMessages: [],
    },
    async () => {
      await page.context().clearCookies();
      await page
        .context()
        .addCookies([
          (await isolatedWorker.createSession(user.id)).cookie,
          { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
        ]);
      const section = fixture.sections[0];
      const teacher = fixture.teachers[0];
      for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        const id = teacher.id;
        await gotoAndWaitForReady(page, `/catalog/teachers/${id}`);
        const { main, identity, aside } = await detailColumns(page, width);
        const expectedFacts = [
          requiredText(teacher.email),
          requiredText(teacher.telephone),
          requiredText(teacher.mobile),
          requiredText(teacher.address),
        ];
        for (const text of expectedFacts)
          await reachable(
            aside.getByRole("definition").filter({ hasText: text }),
          );
        for (const text of [
          requiredText(fixture.departments[0].nameEn),
          requiredText(fixture.titles[0].nameEn),
        ])
          await reachable(
            identity.getByRole("definition").filter({ hasText: text }),
          );
        await expect(
          aside.getByRole("link", {
            name: requiredText(teacher.email),
            exact: true,
          }),
        ).toHaveAttribute("href", `mailto:${teacher.email}`);
        await expect(
          main.getByRole("button", {
            name: /^(Subscribe to section|Unsubscribe from section|Add to Calendar)$/,
          }),
        ).toHaveCount(0);
        const offering = main
          .locator(
            `#sections a[href="/catalog/sections/${section.jwId}"]:visible`,
          )
          .first();
        await reachable(offering);
        await offering.click();
        await expect(page).toHaveURL(
          new RegExp(`/catalog/sections/${section.jwId}$`),
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
    },
  );
});

test("ui.detail-two-column-stream-4 Calendar", {
  tag: "@Calendar/Web",
}, async ({ page, isolatedWorker, run, catalogSubscriptionRun }) => {
  test.setTimeout(90_000);
  const db = isolatedWorker.database.owner;
  const { fixture, user } = await run(() => createFactsFixture(db));
  await catalogSubscriptionRun(
    user,
    {
      calendarMessages: [],
    },
    async () => {
      await page.context().clearCookies();
      await page
        .context()
        .addCookies([
          (await isolatedWorker.createSession(user.id)).cookie,
          { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
        ]);
      const section = fixture.sections[0];
      for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        const id = section.jwId;
        await gotoAndWaitForReady(page, `/catalog/sections/${id}`);
        const actions =
          width >= 1024
            ? page.getByTestId("detail-pinned-summary")
            : page.getByTestId("section-mobile-primary-actions");
        const calendar = actions.getByRole("button", {
          name: "Add to Calendar",
          exact: true,
        });
        await expect(calendar).toBeInViewport();
        await calendar.click();
        const calendarDialog = page.getByRole("dialog");
        await expect(calendarDialog).toBeVisible();
        await expect(calendarDialog.locator("#calendar-url")).toHaveValue(
          `${isolatedWorker.origin}/api/catalog/sections/${section.jwId}/calendar.ics`,
        );
        await page.keyboard.press("Escape");
        await expect(calendarDialog).toBeHidden();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
    },
  );
});

test("ui.detail-two-column-stream-4 Subscription", {
  tag: "@Subscription/Web",
}, async ({ page, isolatedWorker, run, catalogSubscriptionRun }) => {
  test.setTimeout(90_000);
  const db = isolatedWorker.database.owner;
  const { fixture, user } = await run(() => createFactsFixture(db));
  await catalogSubscriptionRun(
    user,
    {
      calendarMessages: Array.from({ length: 6 }, () => ({
        type: "user" as const,
        userId: user.id,
      })),
    },
    async () => {
      await page.context().clearCookies();
      await page
        .context()
        .addCookies([
          (await isolatedWorker.createSession(user.id)).cookie,
          { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
        ]);
      const section = fixture.sections[0];
      for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        const id = section.jwId;
        await gotoAndWaitForReady(page, `/catalog/sections/${id}`);
        const actions =
          width >= 1024
            ? page.getByTestId("detail-pinned-summary")
            : page.getByTestId("section-mobile-primary-actions");
        const subscribe = actions.getByRole("button", {
          name: "Subscribe to section",
          exact: true,
        });
        await expect(subscribe).toBeInViewport();
        await subscribe.click();
        const subscription = page.getByRole("dialog", {
          name: "Subscribe to section",
          exact: true,
        });
        await expect(subscription).toBeVisible();
        const [subscribed] = await Promise.all([
          page.waitForResponse((response) => {
            const url = new URL(response.url());
            return (
              url.pathname === `/catalog/sections/${section.jwId}` &&
              url.search === "?/subscribe" &&
              response.request().method() === "POST"
            );
          }),
          subscription
            .getByRole("button", {
              name: "Subscribe to section",
              exact: true,
            })
            .click(),
        ]);
        expect(subscribed.status()).toBe(200);
        expect(await subscribed.json()).toMatchObject({
          type: "redirect",
          status: 303,
          location: `/catalog/sections/${section.jwId}`,
        });
        const unsubscribe = actions.getByRole("button", {
          name: "Unsubscribe from section",
          exact: true,
        });
        await expect(unsubscribe).toBeVisible();
        await expect
          .poll(() =>
            db.$transaction((db) =>
              db.userSectionSubscription.count({
                where: { userId: user.id, sectionId: section.id },
              }),
            ),
          )
          .toBe(1);
        const [unsubscribed] = await Promise.all([
          page.waitForResponse((response) => {
            const url = new URL(response.url());
            return (
              url.pathname === `/catalog/sections/${section.jwId}` &&
              url.search === "?/unsubscribe" &&
              response.request().method() === "POST"
            );
          }),
          unsubscribe.click(),
        ]);
        expect(unsubscribed.status()).toBe(200);
        expect(await unsubscribed.json()).toMatchObject({
          type: "redirect",
          status: 303,
          location: `/catalog/sections/${section.jwId}`,
        });
        await expect(subscribe).toBeVisible();
        await expect
          .poll(() =>
            db.$transaction((db) =>
              db.userSectionSubscription.count({
                where: { userId: user.id, sectionId: section.id },
              }),
            ),
          )
          .toBe(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
    },
  );
});
