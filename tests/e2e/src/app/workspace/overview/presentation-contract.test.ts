import { expect, type Page } from "@playwright/test";
import {
  type CalendarFixture,
  test,
} from "../../../../utils/calendar-presentation-fixture";
import { assertPriorityView } from "../../../../utils/property-priority";
import { isStepScreenshotCaptureEnabled } from "../../../../utils/screenshot";

async function signIn(page: Page, fixture: CalendarFixture) {
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      await fixture.createSignedSessionCookie(fixture.users[0].id),
      { name: "NEXT_LOCALE", value: "en-us", url: fixture.origin },
    ]);
}
const overviewUrl = (time = "09:30") =>
  `/workspace/overview?snapshotAt=${encodeURIComponent(`2026-04-29T${time}:00+08:00`)}`;

test("overview.decision-page", async ({ page, calendarRun }) => {
  await calendarRun(
    async () => {
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
        ).toEqual([
          "/catalog/courses",
          "/catalog/sections",
          "/catalog/teachers",
        ]);
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
    },
    { accountIndex: 0, calendarTokenCreated: false },
  );
});

test("overview.workspace-card-priority", async ({
  page,
  calendar: fixture,
  calendarDb,
  calendarRun,
}, testInfo) => {
  // Fixed visible values make the four focus-card captures comparable while
  // users, records and resources still belong to this test's private fixture.
  const [course, homework] = await calendarDb((db) =>
    db.$transaction([
      db.course.update({
        where: { id: fixture.course.id },
        data: { nameEn: "Calendar focus course" },
      }),
      db.homework.update({
        where: { id: fixture.homework.id },
        data: {
          title: "Calendar focus homework",
          description: {
            create: { content: "Submit the weekly problem set." },
          },
        },
      }),
      db.section.update({
        where: { id: fixture.section.id },
        data: { code: "CALFOCUS.01" },
      }),
    ]),
  );
  await calendarRun(
    async () => {
      await signIn(page, fixture);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const [time, title, href, label, status, eventTime, detail] of [
          [
            "09:30",
            String(course.nameEn),
            `/catalog/sections/${fixture.section.jwId}`,
            "Courses",
            "Happening now",
            "09:00-10:00",
            "CALFOCUS.01 · Calendar teaching room · —",
          ],
          [
            "11:30",
            homework.title,
            `/catalog/sections/${fixture.section.jwId}?homeworkId=${fixture.homework.id}#homework`,
            "Homework",
            "Up next",
            "12:00",
            "Submit the weekly problem set.",
          ],
        ] as const) {
          await page.goto(overviewUrl(time));
          const focus = page.getByTestId("workspace-overview-focus");
          const action = focus.getByRole("link");
          await expect(action).toHaveCount(1);
          await expect(action).toHaveAttribute("href", href);
          const primaryFields = [
            ["overview-focus-title", title],
            ["overview-focus-label", label],
            ["overview-focus-status", status],
            ["overview-focus-time", eventTime],
          ] as const;
          const secondaryFields = [
            ["overview-focus-date", "Apr 29"],
            ["overview-focus-weekday", "Wednesday"],
            ["overview-focus-detail", detail],
          ] as const;
          const primary = Object.fromEntries(
            primaryFields.map(([id, expected]) => [
              id,
              { locator: action.getByTestId(id), expected },
            ]),
          );
          const secondary = Object.fromEntries(
            secondaryFields.map(([id, expected]) => [
              id,
              { locator: action.getByTestId(id), expected },
            ]),
          );
          await assertPriorityView({
            scope: action,
            identity: action.getByTestId("overview-focus-title"),
            primary,
            secondary,
            tertiary: {},
          });
          for (const field of Object.values({ ...primary, ...secondary })) {
            await expect(field.locator).toHaveCount(1);
            await expect(field.locator).toHaveText(field.expected);
            await expect(field.locator).toBeInViewport({ ratio: 1 });
          }
          const relationships = await action.evaluate(
            (link, ids) => {
              const field = (id: string) => {
                const element = link.querySelector(`[data-testid="${id}"]`);
                if (!element) throw new Error(`Missing focus field ${id}`);
                return element;
              };
              return ids.primary.flatMap((primaryId) =>
                ids.secondary.map((secondaryId) => {
                  const leading = field(primaryId);
                  const trailing = field(secondaryId);
                  return {
                    pair: `${primaryId} before ${secondaryId}`,
                    above:
                      leading.getBoundingClientRect().bottom <=
                      trailing.getBoundingClientRect().top,
                    domOrder: Boolean(
                      leading.compareDocumentPosition(trailing) &
                        Node.DOCUMENT_POSITION_FOLLOWING,
                    ),
                  };
                }),
              );
            },
            {
              primary: Object.keys(primary),
              secondary: Object.keys(secondary),
            },
          );
          for (const relationship of relationships) {
            expect(relationship.above, relationship.pair).toBe(true);
            expect(relationship.domOrder, relationship.pair).toBe(true);
          }
          if (isStepScreenshotCaptureEnabled()) {
            await testInfo.attach(`overview-focus-${width}-${time}`, {
              body: await focus.screenshot(),
              contentType: "image/png",
            });
          }
          await action.click();
          await expect(page).toHaveURL(
            new URL(href, fixture.origin).toString(),
          );
        }
      }
    },
    { accountIndex: 0, calendarTokenCreated: false },
  );
});

test("overview.personal-next-action-page", async ({
  page,
  calendar: fixture,
  calendarRun,
}) => {
  await calendarRun(
    async () => {
      await signIn(page, fixture);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(overviewUrl());
        const focus = page.getByTestId("workspace-overview-focus");
        await expect(focus.getByRole("link")).toContainText(
          String(fixture.course.nameEn),
        );
        const status = focus.getByTestId("overview-focus-status");
        await expect(status).toBeVisible();
        await expect(status).toHaveText("Happening now");
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
    },
    { accountIndex: 0, calendarTokenCreated: false },
  );
});

test("overview.workspace-card-disambiguation", async ({
  page,
  calendar: fixture,
  calendarRun,
  calendarDb,
}) => {
  const extra = await calendarDb(async (db) => {
    const campuses = [];
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
    return { campuses, section };
  });
  await calendarRun(
    async () => {
      await signIn(page, fixture);
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
            path: test
              .info()
              .outputPath(
                `life-spec-business-overview-context-${width}-${time.replace(":", "")}.png`,
              ),
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
    },
    { accountIndex: 0, calendarTokenCreated: false },
  );
});
