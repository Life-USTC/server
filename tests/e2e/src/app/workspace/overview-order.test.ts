import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";

test("overview.card-order", async ({
  page,
  isolatedWorker,
  preferenceFlow,
}, testInfo) => {
  await preferenceFlow.run(async () => {
    const items = [
      "workspace-overview-focus",
      "workspace-overview-today-overdue",
      "workspace-overview-week",
      "workspace-overview-summaries",
      "workspace-overview-links",
    ];
    const actor = await isolatedWorker.createActor();
    const overviewUrl =
      "/workspace/overview?snapshotAt=2026-09-28T09%3A30%3A00%2B08%3A00";
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
          { title: "Overview today task", dueAt: "2026-09-28T18:00:00+08:00" },
          { title: "Overview future task", dueAt: "2026-09-30T18:00:00+08:00" },
        ].map((todo) => ({ ...todo, userId: actor.id, priority: "high" })),
      });
      await db.workspaceLinkPin.create({
        data: { userId: actor.id, slug: "jw" },
      });
    });
    await page.context().addCookies([actor.cookie]);
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
      await expect(
        page.getByTestId("workspace-overview-summaries"),
      ).toContainText(
        locale === "zh-cn"
          ? "未来 3 天（不含今天）"
          : "Next 3 days, excluding today:",
      );
      const courseName =
        locale === "zh-cn" ? "总览布局课程" : "Overview layout course";
      await expect(page.getByTestId("workspace-overview-focus")).toContainText(
        courseName,
      );
      await expect(
        page.getByTestId("workspace-overview-today-overdue"),
      ).toContainText("Overview overdue task");
      await expect(
        page.getByTestId("workspace-overview-today-overdue"),
      ).toContainText("Overview today task");
      await expect(page.getByTestId("workspace-overview-week")).toContainText(
        courseName,
      );
      await expect(
        page.getByTestId("workspace-overview-summaries"),
      ).toContainText("Overview assignment");
      await expect(
        page.getByTestId("workspace-overview-summaries"),
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
        let previousBottom = 0;
        for (const id of items) {
          const section = page.getByTestId(id);
          await expect(section).toBeVisible();
          const box = await section.boundingBox();
          if (!box) throw new Error(`Missing section bounds: ${id}`);
          expect(box.y).toBeGreaterThanOrEqual(previousBottom);
          previousBottom = box.y + box.height;
        }
        await page.screenshot({
          path: testInfo.outputPath(`overview-order-${locale}-${width}.png`),
          fullPage: true,
        });
      }
    }
  });
});
