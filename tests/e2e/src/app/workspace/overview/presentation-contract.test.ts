import { expect, type Page, test } from "@playwright/test";
import { createCalendarContractFixture } from "../../../../utils/calendar-contract";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../../utils/workspace-task-filters";

async function signIn(page: Page, owner: string) {
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      await createSignedSessionCookie(owner),
      { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
    ]);
}
const overviewUrl = (time = "09:30") =>
  `/workspace/overview?snapshotAt=${encodeURIComponent(`2026-04-29T${time}:00+08:00`)}`;

test("overview.decision-page", async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.context().clearCookies();
    await page.goto("/");
    const entries = page.locator('#main-content a[data-slot="item"]');
    await expect(entries).toHaveCount(6);
    expect(
      await entries.evaluateAll((nodes) =>
        nodes.slice(0, 3).map((node) => node.getAttribute("href")),
      ),
    ).toEqual(["/catalog/courses", "/catalog/sections", "/catalog/teachers"]);
    for (const path of ["courses", "sections", "teachers"]) {
      const link = page.locator(
        `#main-content a[data-slot="item"][href="/catalog/${path}"]`,
      );
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/catalog/${path}`));
      await expect(page.getByRole("searchbox")).toBeVisible();
      await page.goto("/");
    }
  }
});

test("overview.workspace-card-priority", async ({ page }) => {
  const fixture = await createCalendarContractFixture();
  try {
    await signIn(page, fixture.users[0].id);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [time, title, href] of [
        [
          "09:30",
          String(fixture.course.nameEn),
          `/catalog/sections/${fixture.section.jwId}`,
        ],
        [
          "11:30",
          fixture.homework.title,
          `/catalog/sections/${fixture.section.jwId}?homeworkId=${fixture.homework.id}#homework`,
        ],
      ] as const) {
        await page.goto(overviewUrl(time));
        const focus = page.getByTestId("workspace-overview-focus");
        const action = focus.getByRole("link");
        await expect(action).toContainText(title);
        await expect(action).toHaveAttribute("href", href);
        await expect(action).toContainText(
          time === "09:30" ? "09:00-10:00" : "12:00",
        );
        const titleBox = await action
          .getByText(title, { exact: true })
          .boundingBox();
        const secondary = await action.locator("p").boundingBox();
        expect(titleBox?.y).toBeLessThan(secondary?.y ?? 0);
        await action.click();
        await expect(page).toHaveURL(
          new URL(href, PLAYWRIGHT_BASE_URL).toString(),
        );
      }
    }
  } finally {
    await fixture.cleanup();
  }
});

test("overview.personal-next-action-page", async ({ page }) => {
  const fixture = await createCalendarContractFixture();
  try {
    await signIn(page, fixture.users[0].id);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(overviewUrl());
      const focus = page.getByTestId("workspace-overview-focus");
      await expect(focus.getByRole("link")).toContainText(
        String(fixture.course.nameEn),
      );
      await expect(focus).toContainText("Now");
      const focusBox = await focus.boundingBox();
      for (const id of [
        "workspace-overview-today-overdue",
        "workspace-overview-week",
        "workspace-overview-summaries",
        "workspace-overview-links",
      ]) {
        const box = await page.getByTestId(id).boundingBox();
        expect(box?.y).toBeGreaterThan(
          (focusBox?.y ?? 0) + (focusBox?.height ?? 0),
        );
      }
      await expect(
        page.locator('#main-content a[href="/catalog/teachers"]'),
      ).toHaveCount(0);
      await expect(
        page.locator('#main-content a[href="/catalog/courses"]'),
      ).toHaveCount(0);
    }
  } finally {
    await fixture.cleanup();
  }
});

test("overview.workspace-card-disambiguation", async ({ page }) => {
  const fixture = await createCalendarContractFixture();
  const extra = await withE2ePrisma(async (db) => {
    const campuses = [];
    const buildings = [];
    const rooms = [];
    for (const [index, label] of ["North", "South"].entries()) {
      const campus = await db.campus.create({
        data: {
          jwId: fixture.section.jwId + 50 + index,
          nameCn: `${label}校区`,
          nameEn: `${label} campus`,
        },
      });
      campuses.push(campus);
      const building = await db.building.create({
        data: {
          jwId: fixture.section.jwId + 52 + index,
          nameCn: `${label}教学楼`,
          nameEn: `${label} building`,
          code: `${fixture.course.code}-${index}`,
          campusId: campus.id,
        },
      });
      buildings.push(building);
      rooms.push(
        await db.room.create({
          data: {
            jwId: fixture.section.jwId + 54 + index,
            nameCn: `${label}教室`,
            nameEn: `${label} room`,
            code: `${fixture.course.code}-${index}`,
            virtual: false,
            seats: 10,
            seatsForSection: 10,
            buildingId: building.id,
          },
        }),
      );
    }
    await db.schedule.updateMany({
      where: { sectionId: fixture.section.id },
      data: { roomId: rooms[0].id, customPlace: null },
    });
    const section = await db.section.create({
      data: {
        jwId: fixture.section.jwId + 56,
        code: `${fixture.course.code}.02`,
        courseId: fixture.course.id,
        semesterId: fixture.section.semesterId,
      },
    });
    await db.userSectionSubscription.create({
      data: { userId: fixture.users[0].id, sectionId: section.id },
    });
    const group = await db.scheduleGroup.create({
      data: {
        jwId: fixture.section.jwId + 57,
        sectionId: section.id,
        no: 1,
        limitCount: 10,
        stdCount: 1,
        actualPeriods: 2,
        isDefault: true,
      },
    });
    await db.schedule.create({
      data: {
        sectionId: section.id,
        scheduleGroupId: group.id,
        date: new Date(`${fixture.date}T00:00:00Z`),
        weekday: 3,
        startTime: 1000,
        endTime: 1100,
        startUnit: 3,
        endUnit: 4,
        weekIndex: 8,
        periods: 2,
        roomId: rooms[1].id,
      },
    });
    await db.todo.update({
      where: { id: fixture.todo.id },
      data: { priority: "high" },
    });
    await db.todo.create({
      data: {
        userId: fixture.users[0].id,
        title: fixture.todo.title,
        priority: "low",
        dueAt: new Date(`${fixture.date}T16:00:00+08:00`),
      },
    });
    return { campuses, buildings, rooms, section, group };
  });
  try {
    await signIn(page, fixture.users[0].id);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [time, section, campus] of [
        ["09:30", fixture.section, extra.campuses[0]],
        ["10:30", extra.section, extra.campuses[1]],
      ] as const) {
        await page.goto(overviewUrl(time));
        const focus = page.getByTestId("workspace-overview-focus");
        await expect(focus).toContainText(String(fixture.course.nameEn));
        await expect(focus).toContainText(String(campus.nameEn));
        await page.screenshot({
          path: `/tmp/life-spec-business-overview-context-${width}-${time.replace(":", "")}.png`,
          fullPage: true,
        });
        await expect(focus).toContainText(String(section.code));
        const today = page.getByTestId("workspace-overview-today-overdue");
        for (const [item, place] of [
          [fixture.section, extra.campuses[0]],
          [extra.section, extra.campuses[1]],
        ] as const) {
          const row = today.locator(
            `a[data-slot="item"][href="/catalog/sections/${item.jwId}"]`,
          );
          await expect(row).toContainText(String(item.code));
          await expect(row).toContainText(String(place.nameEn));
          await expect(row.locator('[data-slot="item-title"]')).toHaveText(
            String(fixture.course.nameEn),
          );
        }
        const todos = page
          .getByTestId("workspace-overview-summaries")
          .locator('a[data-slot="item"][href="/workspace/todos"]')
          .filter({ hasText: fixture.todo.title });
        await expect(todos).toHaveCount(2);
        await expect(todos.filter({ hasText: "High" })).toHaveCount(1);
        await expect(todos.filter({ hasText: "Low" })).toHaveCount(1);
      }
    }
  } finally {
    await withE2ePrisma(async (db) => {
      await db.schedule.deleteMany({ where: { sectionId: extra.section.id } });
      await db.scheduleGroup.delete({ where: { id: extra.group.id } });
      await db.userSectionSubscription.deleteMany({
        where: { sectionId: extra.section.id },
      });
      await db.section.delete({ where: { id: extra.section.id } });
    });
    await fixture.cleanup();
    await withE2ePrisma(async (db) => {
      await db.room.deleteMany({
        where: { id: { in: extra.rooms.map((x) => x.id) } },
      });
      await db.building.deleteMany({
        where: { id: { in: extra.buildings.map((x) => x.id) } },
      });
      await db.campus.deleteMany({
        where: { id: { in: extra.campuses.map((x) => x.id) } },
      });
    });
  }
});
