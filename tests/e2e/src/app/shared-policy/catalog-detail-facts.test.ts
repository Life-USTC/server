import { expect, type Locator, test } from "@playwright/test";
import {
  cleanupCatalogContractFixture,
  createCatalogContractFixture,
} from "../../../../shared/catalog-contract-fixture";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

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

test("ui.detail-two-column-stream-4", async ({ page }) => {
  const fixture = await withE2ePrisma(createCatalogContractFixture);
  const { user, classType, courseType } = await withE2ePrisma(async (db) => {
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
        email: `${fixture.marker}@example.test`,
        name: "Catalog facts viewer",
        username: fixture.marker,
      },
    });
    return { user, classType, courseType };
  });
  try {
    await page.context().clearCookies();
    await page
      .context()
      .addCookies([
        await createSignedSessionCookie(user.id),
        { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
      ]);
    const section = fixture.sections[0];
    const teacher = fixture.teachers[0];
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const kind of ["section", "course", "teacher"] as const) {
        const id =
          kind === "section"
            ? section.jwId
            : kind === "course"
              ? fixture.courses[0].jwId
              : teacher.id;
        await gotoAndWaitForReady(page, `/catalog/${kind}s/${id}`);
        const main = page.locator("#main-content");
        const identity = main.locator("[data-detail-identity]");
        const aside = main.locator("aside");
        const reading = main.locator("[data-detail-reading-stream]");
        await expect(identity).toHaveCount(1);
        await expect(aside).toHaveCount(1);
        if (width === 1280) {
          const boxes = await Promise.all(
            [identity, aside, reading].map(bounds),
          );
          expect(boxes[0].x).toBeGreaterThan(boxes[2].x + boxes[2].width);
          expect(boxes[1].x).toBe(boxes[0].x);
        }
        if (kind === "section") {
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
          const actions =
            width >= 1024
              ? page.getByTestId("detail-pinned-summary")
              : page.getByTestId("section-mobile-primary-actions");
          const calendar = actions.getByRole("button", {
            name: "Add to Calendar",
            exact: true,
          });
          const subscribe = actions.getByRole("button", {
            name: "Subscribe to section",
            exact: true,
          });
          await expect(calendar).toBeInViewport();
          await expect(subscribe).toBeInViewport();
          await calendar.click();
          const calendarDialog = page.getByRole("dialog");
          await expect(calendarDialog).toBeVisible();
          await expect(calendarDialog.locator("#calendar-url")).toHaveValue(
            `${PLAYWRIGHT_BASE_URL}/api/catalog/sections/${section.jwId}/calendar.ics`,
          );
          await page.keyboard.press("Escape");
          await expect(calendarDialog).toBeHidden();
          await subscribe.click();
          const subscription = page.getByRole("dialog", {
            name: "Subscribe to section",
            exact: true,
          });
          await expect(subscription).toBeVisible();
          await subscription
            .getByRole("button", { name: "Subscribe to section", exact: true })
            .click();
          const unsubscribe = actions.getByRole("button", {
            name: "Unsubscribe from section",
            exact: true,
          });
          await expect(unsubscribe).toBeVisible();
          await expect
            .poll(() =>
              withE2ePrisma((db) =>
                db.userSectionSubscription.count({
                  where: { userId: user.id, sectionId: section.id },
                }),
              ),
            )
            .toBe(1);
          await unsubscribe.click();
          await expect(subscribe).toBeVisible();
          await expect
            .poll(() =>
              withE2ePrisma((db) =>
                db.userSectionSubscription.count({
                  where: { userId: user.id, sectionId: section.id },
                }),
              ),
            )
            .toBe(0);
        } else {
          const expectedFacts =
            kind === "course"
              ? [
                  requiredText(classType.nameEn),
                  requiredText(courseType.nameEn),
                ]
              : [
                  requiredText(teacher.email),
                  requiredText(teacher.telephone),
                  requiredText(teacher.mobile),
                  requiredText(teacher.address),
                ];
          for (const text of expectedFacts)
            await reachable(
              aside.getByRole("definition").filter({ hasText: text }),
            );
          if (kind === "teacher") {
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
          }
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
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
    }
  } finally {
    await withE2ePrisma(async (db) => {
      await db.auditLog.deleteMany({
        where: { OR: [{ userId: user.id }, { subjectUserId: user.id }] },
      });
      await db.user.delete({ where: { id: user.id } });
      await cleanupCatalogContractFixture(db, fixture);
      await db.classType.delete({ where: { id: classType.id } });
      await db.courseType.delete({ where: { id: courseType.id } });
    });
  }
});
