import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

test("cases.semester.no-current-semester-1", async ({ page }) => {
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
          path: "/tmp/life-policy-no-semester-after.png",
          fullPage: true,
        });
      await expect(page.locator("#main-content")).toContainText(
        locale === "en-us"
          ? "Current semester is unavailable."
          : "暂无当前学期信息。",
      );
      expect(await page.locator("#main-content").innerText()).not.toContain(
        locale === "en-us"
          ? "You are only subscribed to past-term sections right now."
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
    const semesters = await db.semester.findMany({
      select: { id: true, startDate: true, endDate: true },
    });
    await db.semester.updateMany({
      data: {
        startDate: new Date("2000-01-01T00:00:00.000Z"),
        endDate: new Date("2000-06-01T00:00:00.000Z"),
      },
    });
    return { user, section, semesters };
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
      await gotoAndWaitForReady(page, "/workspace/overview");
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
        name: /Confirm .*section subscriptions|确认订阅/,
      });
      await expect(dialog).toContainText(fixture.section.code);
      await expect(dialog).toContainText(DEV_SEED.previousSemesterNameCn);
      await page.keyboard.press("Escape");
    }
  } finally {
    await withE2ePrisma(async (db) => {
      for (const semester of fixture.semesters)
        await db.semester.update({
          where: { id: semester.id },
          data: { startDate: semester.startDate, endDate: semester.endDate },
        });
      await db.auditLog.deleteMany({ where: { userId: fixture.user.id } });
      await db.user.delete({ where: { id: fixture.user.id } });
    });
  }
});
