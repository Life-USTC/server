import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/signed-session-cookie";

test("cases.semester.no-current-semester-1", async ({ page }, testInfo) => {
  const marker = `semester-policy-${crypto.randomUUID()}`;
  const fixture = await withE2ePrisma(async (db) => {
    const user = await db.user.create({
      data: {
        name: "Semester policy user",
        username: `sp${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${marker}@example.test`,
      },
    });
    const section = await db.section.findUniqueOrThrow({
      where: { jwId: DEV_SEED.previousSection.jwId },
    });
    await db.userSectionSubscription.create({
      data: { userId: user.id, sectionId: section.id },
    });
    await db.todo.create({ data: { userId: user.id, title: marker } });
    await db.userYoungEventSubscription.create({
      data: {
        userId: user.id,
        youngId: DEV_SEED.youngEvent.youngId,
        observedState: "open",
      },
    });
    return { user, section };
  });
  try {
    await page
      .context()
      .addCookies([await createSignedSessionCookie(fixture.user.id)]);
    // No fixture semester covers this explicit snapshot date.
    const snapshot =
      "/workspace/overview?snapshotAt=2030-01-01T00:00:00%2B08:00";
    for (const locale of ["en-us", "zh-cn"]) {
      expect(
        (
          await page.request.post("/api/account/preferences", {
            data: { locale },
          })
        ).status(),
      ).toBe(200);
      await gotoAndWaitForReady(page, snapshot);
      if (locale === "en-us")
        await page.screenshot({
          path: testInfo.outputPath("no-semester-after.png"),
          fullPage: true,
        });
      await expect(page.locator("#main-content")).toContainText(
        locale === "en-us"
          ? "Current semester is unavailable."
          : "暂无当前学期信息。",
      );
      expect(await page.locator("#main-content").innerText()).not.toContain(
        locale === "en-us"
          ? "You only have past-term section subscriptions."
          : "你目前只订阅了往期教学班",
      );
      const todoLink = page
        .locator('#main-content a[href="/workspace/todos"]')
        .first();
      await expect(todoLink).toBeVisible();
      await todoLink.click();
      await expect(page.locator("#main-content")).toContainText(marker);
      await gotoAndWaitForReady(page, snapshot);
      await page
        .getByRole("link", { name: /View Past Homework|查看往期作业/ })
        .click();
      await expect(page.locator("#main-content")).toContainText(
        DEV_SEED.homeworks.historicalTitle,
      );
      await gotoAndWaitForReady(page, "/workspace/subscriptions/activities");
      await expect(page.locator("#main-content")).toContainText(
        DEV_SEED.youngEvent.name,
      );
      const activities = await page.request.get(
        "/api/workspace/young-event-subscriptions",
      );
      expect(activities.status()).toBe(200);
      expect(JSON.stringify(await activities.json())).toContain(
        DEV_SEED.youngEvent.youngId,
      );
    }
  } finally {
    await withE2ePrisma(async (db) => {
      await db.auditLog.deleteMany({ where: { userId: fixture.user.id } });
      await db.user.delete({ where: { id: fixture.user.id } });
    });
  }
});

test("cases.semester.no-current-semester-2", async ({ page }) => {
  const marker = `semester-import-${crypto.randomUUID()}`;
  const fixture = await withE2ePrisma(async (db) => {
    const user = await db.user.create({
      data: {
        name: "Semester import user",
        username: `si${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${marker}@example.test`,
      },
    });
    const section = await db.section.findUniqueOrThrow({
      where: { jwId: DEV_SEED.previousSection.jwId },
      include: { semester: true },
    });
    await db.userSectionSubscription.create({
      data: { userId: user.id, sectionId: section.id },
    });
    return { user, section };
  });
  try {
    await page
      .context()
      .addCookies([await createSignedSessionCookie(fixture.user.id)]);
    for (const locale of ["en-us", "zh-cn"]) {
      expect(
        (
          await page.request.post("/api/account/preferences", {
            data: { locale },
          })
        ).status(),
      ).toBe(200);
      await gotoAndWaitForReady(
        page,
        "/workspace/overview?snapshotAt=2030-01-01T00:00:00%2B08:00",
      );
      await expect(
        page.getByRole("link", {
          name: /Browse Courses|浏览课程/,
          exact: true,
        }),
      ).toHaveAttribute("href", "/catalog/courses");
      await expect(
        page.getByRole("link", {
          name: /Browse Sections|浏览班级/,
          exact: true,
        }),
      ).toHaveAttribute("href", "/catalog/sections");
      await page
        .getByRole("link", {
          name: /View Past Sections|查看往期班级/,
          exact: true,
        })
        .click();
      await expect(page).toHaveURL(/\/workspace\/subscriptions$/);
      await gotoAndWaitForReady(
        page,
        "/workspace/subscriptions?snapshotAt=2030-01-01T00:00:00%2B08:00",
      );
      await expect(
        page
          .locator(
            `#main-content a[href="/catalog/sections/${DEV_SEED.previousSection.jwId}"]`,
          )
          .filter({ visible: true })
          .first(),
      ).toBeVisible();
      await page
        .getByRole("button", { name: /Bulk Add Subscriptions|批量添加订阅/ })
        .click();
      await expect(page.locator("#bulk-import-semester")).toHaveValue("");
      await page
        .locator("#bulk-import-section-codes")
        .fill(fixture.section.code);
      const match = page.getByRole("button", {
        name: /Match Sections|识别并匹配课程/,
      });
      await expect(match).toBeDisabled();
      await page
        .locator("#bulk-import-semester")
        .selectOption(String(fixture.section.semesterId));
      await expect(match).toBeEnabled();
      await match.click();
      const dialog = page.getByRole("dialog", {
        name: /Confirm .*section subscriptions?|确认订阅/,
      });
      await expect(dialog).toContainText(fixture.section.code);
      await expect(dialog).toContainText(
        locale === "en-us" ? "Fall 2025" : DEV_SEED.previousSemesterNameCn,
      );
      await page.keyboard.press("Escape");
    }
  } finally {
    await withE2ePrisma(async (db) => {
      await db.auditLog.deleteMany({ where: { userId: fixture.user.id } });
      await db.user.delete({ where: { id: fixture.user.id } });
    });
  }
});

test("cases.semester.only-non-current-semester-subscriptions-1", async ({
  page,
}) => {
  const marker = `past-term-${crypto.randomUUID()}`;
  const user = await withE2ePrisma(async (db) => {
    const user = await db.user.create({
      data: {
        name: "Past term user",
        username: `pt${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${marker}@example.test`,
      },
    });
    const section = await db.section.findUniqueOrThrow({
      where: { jwId: DEV_SEED.previousSection.jwId },
    });
    await db.userSectionSubscription.create({
      data: { userId: user.id, sectionId: section.id },
    });
    return user;
  });
  try {
    await page.context().addCookies([await createSignedSessionCookie(user.id)]);
    for (const locale of ["en-us", "zh-cn"]) {
      expect(
        (
          await page.request.post("/api/account/preferences", {
            data: { locale },
          })
        ).status(),
      ).toBe(200);
      await gotoAndWaitForReady(
        page,
        "/workspace/overview?snapshotAt=2026-04-29T08:00:00%2B08:00",
      );
      await expect(
        page.getByRole("heading", {
          name:
            locale === "en-us"
              ? "No current-term section subscriptions"
              : "当前学期暂无教学班订阅",
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator("#main-content")).toContainText(
        locale === "en-us"
          ? "You only have past-term section subscriptions."
          : "你目前只订阅了往期教学班。",
      );
      expect(await page.locator("#main-content").innerText()).not.toContain(
        locale === "en-us"
          ? "Current semester is unavailable."
          : "暂无当前学期信息。",
      );
      await page
        .getByRole("link", { name: /View Past Homework|查看往期作业/ })
        .click();
      const homework = page
        .getByRole("row")
        .filter({ hasText: DEV_SEED.homeworks.historicalTitle });
      await expect(homework).toContainText(
        locale === "en-us" ? "Fall 2025" : DEV_SEED.previousSemesterNameCn,
      );
      expect(await homework.innerText()).not.toContain(DEV_SEED.semesterNameCn);
      await gotoAndWaitForReady(page, "/workspace/subscriptions");
      await expect(page.locator("#main-content")).toContainText(
        locale === "en-us" ? "Fall 2025" : DEV_SEED.previousSemesterNameCn,
      );
      await expect(
        page.getByTestId("subscription-course-link").filter({ visible: true }),
      ).toHaveCount(1);
    }
  } finally {
    await withE2ePrisma(async (db) => {
      await db.auditLog.deleteMany({ where: { userId: user.id } });
      await db.user.delete({ where: { id: user.id } });
    });
  }
});
