import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";

type Bounds = { x: number; y: number; width: number; height: number };
/** The overview pairs its two lists from the shared `lg` breakpoint. */
const DESKTOP_COLUMN_WIDTH = 1024;

test("overview.card-order", { tag: "@Overview/Web" }, async ({
  page,
  isolatedWorker,
  preferenceFlow,
}) => {
  const items = [
    "workspace-overview-focus",
    "workspace-overview-urgency",
    "workspace-overview-upcoming",
    "workspace-overview-links",
  ];
  const overviewUrl =
    "/workspace/overview?snapshotAt=2026-09-28T09%3A30%3A00%2B08%3A00";
  const actor = await preferenceFlow.prepare(async () => {
    const actor = await isolatedWorker.createActor();
    await isolatedWorker.database.owner.$transaction(async (db) => {
      const section = await db.section.create({
        data: {
          jwId: 1,
          code: "OVERVIEW.01",
          course: {
            create: {
              jwId: 1,
              code: "OVERVIEW",
              nameCn: "总览布局课程",
              nameEn: "Overview layout course",
            },
          },
          semester: {
            create: {
              jwId: 1,
              code: "2026-autumn",
              nameCn: "2026年秋季学期",
              startDate: new Date("2026-08-31T00:00:00Z"),
              endDate: new Date("2027-01-31T00:00:00Z"),
            },
          },
          sectionSubscriptions: { create: { userId: actor.id } },
        },
      });
      const group = await db.scheduleGroup.create({
        data: {
          jwId: 1,
          sectionId: section.id,
          no: 1,
          limitCount: 20,
          stdCount: 1,
          actualPeriods: 2,
          isDefault: true,
        },
      });
      await db.schedule.create({
        data: {
          sectionId: section.id,
          scheduleGroupId: group.id,
          date: new Date("2026-09-28T00:00:00Z"),
          weekday: 1,
          startTime: 900,
          endTime: 1000,
          startUnit: 1,
          endUnit: 2,
          weekIndex: 5,
          periods: 2,
        },
      });
      await db.homework.create({
        data: {
          sectionId: section.id,
          createdById: actor.id,
          title: "Overview assignment",
          submissionDueAt: new Date("2026-09-28T18:00:00+08:00"),
        },
      });
      await db.exam.create({
        data: {
          jwId: 1,
          sectionId: section.id,
          examDate: new Date("2026-09-29T00:00:00Z"),
          startTime: 1300,
          endTime: 1400,
          examType: 1,
          examTakeCount: 1,
        },
      });
      await db.todo.createMany({
        data: [
          {
            title: "Overview overdue task",
            dueAt: "2026-09-27T18:00:00+08:00",
          },
          {
            title: "Overview today task",
            dueAt: "2026-09-28T18:00:00+08:00",
          },
          {
            title: "Overview future task",
            dueAt: "2026-09-30T18:00:00+08:00",
          },
        ].map((todo) => ({ ...todo, userId: actor.id, priority: "high" })),
      });
      await db.workspaceLinkPin.create({
        data: { userId: actor.id, slug: "jw" },
      });
    });
    await page.context().addCookies([actor.cookie]);
    return actor;
  });
  await preferenceFlow.run(async () => {
    const session = await page.request.get("/api/auth/get-session");
    expect(session.status()).toBe(200);
    expect((await session.json()).user.id).toBe(actor.id);
    await gotoAndWaitForReady(page, overviewUrl);
    await expect(page.getByTestId("workspace-overview-focus")).toBeVisible();
    for (const locale of ["zh-cn", "en-us"]) {
      const response = await page.request.post("/api/account/preferences", {
        data: { locale },
      });
      expect(response.status()).toBe(200);
      await gotoAndWaitForReady(page, overviewUrl);
      const courseName =
        locale === "zh-cn" ? "总览布局课程" : "Overview layout course";
      await expect(page.getByTestId("workspace-overview-focus")).toContainText(
        courseName,
      );
      await expect(
        page.getByTestId("workspace-overview-urgency"),
      ).toContainText("Overview overdue task");
      await expect(
        page.getByTestId("workspace-overview-urgency"),
      ).toContainText("Overview today task");
      await expect(
        page.getByTestId("workspace-overview-urgency"),
      ).toContainText("Overview assignment");
      await expect(
        page.getByTestId("workspace-overview-upcoming"),
      ).toContainText("Overview future task");
      await expect(
        page
          .getByTestId("workspace-overview-links")
          .locator('a[href="/api/catalog/links/resolve?slug=jw"]'),
      ).toContainText(
        locale === "zh-cn" ? "教务系统" : "Academic Affairs System",
      );
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        const observed = await page
          .locator("[data-overview-sections] > *")
          .evaluateAll((nodes) =>
            nodes.map(
              (node) =>
                node.getAttribute("data-testid") ??
                node
                  .querySelector(":scope > [data-testid]")
                  ?.getAttribute("data-testid") ??
                null,
            ),
          );
        expect(observed).toEqual(items);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        ).toBe(true);
        for (const title of [
          "Overview assignment",
          "Overview overdue task",
          "Overview today task",
          "Overview future task",
        ]) {
          await expect(
            page
              .locator("[data-overview-sections] [data-slot='item-title']")
              .filter({ hasText: title }),
          ).toHaveCount(1);
        }
        await expect(
          page
            .getByTestId("workspace-overview-upcoming")
            .locator('a[href="/catalog/sections/1"]'),
        ).toHaveCount(0);
        for (const tab of ["calendar", "homeworks", "todos", "exams"]) {
          await expect(
            page
              .getByTestId("workspace-overview-upcoming")
              .locator(`nav a[href="/workspace/${tab}"]`),
          ).toBeVisible();
        }
        const bounds: Record<string, Bounds> = {};
        for (const id of items) {
          const section = page.getByTestId(id);
          await expect(section).toBeVisible();
          const box = await section.boundingBox();
          if (!box) throw new Error(`Missing section bounds: ${id}`);
          bounds[id] = box;
        }
        const frame = await page
          .locator("[data-overview-sections]")
          .boundingBox();
        if (!frame) throw new Error("Missing overview frame bounds");
        const focus = bounds["workspace-overview-focus"];
        const urgency = bounds["workspace-overview-urgency"];
        const upcoming = bounds["workspace-overview-upcoming"];
        const links = bounds["workspace-overview-links"];
        // Focus keeps the full content width above every list at both widths.
        expect(focus.width).toBeGreaterThanOrEqual(frame.width - 1);
        for (const band of [urgency, upcoming, links])
          expect(band.y).toBeGreaterThanOrEqual(focus.y + focus.height);
        if (width >= DESKTOP_COLUMN_WIDTH) {
          // Desktop pairs the two lists in one row: urgency owns the left
          // half, upcoming the right half, and neither may claim the width
          // the other needs.
          expect(Math.abs(urgency.y - upcoming.y)).toBeLessThanOrEqual(1);
          expect(urgency.x).toBeLessThanOrEqual(frame.x + 1);
          expect(urgency.x + urgency.width).toBeLessThanOrEqual(upcoming.x);
          expect(upcoming.x + upcoming.width).toBeGreaterThanOrEqual(
            frame.x + frame.width - 1,
          );
          for (const list of [urgency, upcoming])
            expect(list.width).toBeLessThan(frame.width * 0.55);
          // Shortcuts span the full width under both lists.
          expect(links.width).toBeGreaterThanOrEqual(frame.width - 1);
          expect(links.y).toBeGreaterThanOrEqual(
            Math.max(urgency.y + urgency.height, upcoming.y + upcoming.height),
          );
          // The paired row is the point of the desktop layout: the first row
          // of both lists is readable without scrolling.
          for (const id of [
            "workspace-overview-urgency",
            "workspace-overview-upcoming",
          ])
            await expect(
              page.getByTestId(id).locator("a[data-overview-item]").first(),
            ).toBeInViewport();
        } else {
          // Mobile keeps one strictly stacked column.
          let previousBottom = 0;
          for (const id of items) {
            const box = bounds[id];
            expect(box.x).toBeLessThanOrEqual(frame.x + 1);
            expect(box.width).toBeGreaterThanOrEqual(frame.width - 1);
            expect(box.y).toBeGreaterThanOrEqual(previousBottom);
            previousBottom = box.y + box.height;
          }
        }
      }
    }
  });
});

test("overview.omit-empty-bands", { tag: "@Overview/Web" }, async ({
  page,
  isolatedWorker,
  preferenceFlow,
}) => {
  await preferenceFlow.prepare(async () => {
    const actor = await isolatedWorker.createActor();
    await page.context().addCookies([actor.cookie]);
  });
  await preferenceFlow.run(async () => {
    for (const locale of ["zh-cn", "en-us"]) {
      const response = await page.request.post("/api/account/preferences", {
        data: { locale },
      });
      expect(response.status()).toBe(200);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await gotoAndWaitForReady(
          page,
          "/workspace/overview?snapshotAt=2026-09-28T09%3A30%3A00%2B08%3A00",
        );
        const focus = page.getByTestId("workspace-overview-focus");
        await expect(focus.getByRole("status")).toHaveCount(0);
        await expect(focus.locator("p")).toHaveText(
          locale === "en-us"
            ? "Nothing is due or scheduled in the next 7 days."
            : "未来 7 天没有待完成或已安排的事项。",
        );
        await expect(focus.getByRole("link")).toHaveCount(0);
        expect((await focus.boundingBox())?.height).toBeLessThan(100);
        for (const band of [
          "urgency",
          "upcoming",
          "week",
          "summaries",
          "today-overdue",
        ]) {
          await expect(
            page.getByTestId(`workspace-overview-${band}`),
          ).toHaveCount(0);
        }
        const links = page.getByTestId("workspace-overview-links");
        if (await links.count())
          expect((await links.boundingBox())?.y).toBeGreaterThan(
            (await focus.boundingBox())?.y ?? 0,
          );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        ).toBe(true);
      }
    }
  });
});
