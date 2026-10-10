import { expect } from "@playwright/test";
import {
  prepareCalendarRead,
  readCalendarState,
} from "../../../../utils/calendar-read-observation";
import { test } from "../../../../utils/private-calendar-fixture";
import { parseTextContent } from "../../api/mcp/helpers";

for (const [domain, method, feature] of [
  ["Overview", "Web", ""],
  ["Overview", "MCP", "workspace.overview"],
  ["Subscription", "MCP", "workspace.subscription"],
  ["Homework", "MCP", "workspace.homework"],
  ["Schedule", "MCP", "workspace.schedule"],
  ["Exam", "MCP", "workspace.exam"],
] as const) {
  test(`overview.historical-subscriptions-remain-discoverable ${domain} ${method}`, {
    tag: `@${domain}/${method}`,
  }, async ({
    page,
    calendarProtocolRun,
    isolatedWorker,
    createCalendar,
    oauthOwner,
  }) => {
    test.setTimeout(120_000);
    await calendarProtocolRun(async (io) => {
      const db = isolatedWorker.database.owner;
      const fixture = await createCalendar();
      const semester = await db.$transaction(async (tx) => {
        const past = await tx.semester.create({
          data: {
            jwId: fixture.section.jwId + 40,
            nameCn: "历史验证学期",
            code: `HISTORY-${fixture.course.code}`,
            startDate: new Date("2025-09-01T00:00:00Z"),
            endDate: new Date("2026-01-15T00:00:00Z"),
          },
        });
        await tx.section.update({
          where: { id: fixture.section.id },
          data: { semesterId: past.id },
        });
        await tx.schedule.updateMany({
          where: { sectionId: fixture.section.id },
          data: { date: new Date("2026-01-07T00:00:00Z") },
        });
        await tx.exam.updateMany({
          where: { sectionId: fixture.section.id },
          data: { examDate: new Date("2026-01-07T00:00:00Z") },
        });
        await tx.homework.update({
          where: { id: fixture.homework.id },
          data: { submissionDueAt: new Date("2026-01-07T12:00:00+08:00") },
        });
        return past;
      });
      const expectedState = await readCalendarState(db);
      await page.context().clearCookies();
      const client = await prepareCalendarRead(page, oauthOwner, io, fixture, {
        name: "overview-history",
        scopes: [
          "workspace.overview:read",
          "workspace.subscription:read",
          "workspace.homework:read",
          "workspace.schedule:read",
          "workspace.exam:read",
        ],
        tools: (
          [
            ["workspace_snapshot_get", "workspace.overview"],
            ["workspace_subscription_list", "workspace.subscription"],
            ["workspace_homework_list", "workspace.homework"],
            ["workspace_homework_list", "workspace.homework"],
            ["workspace_schedule_list", "workspace.schedule"],
            ["workspace_schedule_list", "workspace.schedule"],
            ["workspace_exam_list", "workspace.exam"],
            ["workspace_exam_list", "workspace.exam"],
          ] as const
        ).filter(([, owner]) => owner === feature),
        usage: (
          [
            ["workspace.overview", 1],
            ["workspace.subscription", 1],
            ["workspace.homework", 2],
            ["workspace.schedule", 2],
            ["workspace.exam", 2],
          ] as const
        ).filter(([owner]) => owner === feature),
        feedTokenCreated: method === "Web",
      });
      await page
        .context()
        .addCookies([
          { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
        ]);
      const overviewUrl =
        "/workspace/overview?snapshotAt=2026-04-29T09%3A30%3A00%2B08%3A00";
      if (method === "Web") {
        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: 1000 });
          for (const [label, path] of [
            ["View Past Sections", "subscriptions"],
            ["View Past Homework", "homeworks"],
            ["View Past Schedule", "calendar"],
            ["Exams", "exams"],
          ] as const) {
            await page.goto(overviewUrl);
            const context = page.getByTestId("workspace-overview-term-context");
            await expect(context).toContainText(
              "Your past sections, homework, schedules, and exams are still available.",
            );
            await context
              .getByRole("link", { name: label, exact: true })
              .click();
            await expect(page).toHaveURL(new RegExp(`/workspace/${path}`));
            if (path === "subscriptions")
              await expect(
                page
                  .locator(
                    `a[data-testid="subscription-course-link"][href="/catalog/sections/${fixture.section.jwId}"]`,
                  )
                  .filter({ visible: true }),
              ).toBeVisible();
            if (path === "homeworks")
              await expect(
                page
                  .getByText(fixture.homework.title, { exact: true })
                  .filter({ visible: true })
                  .first(),
              ).toBeVisible();
            if (path === "calendar") {
              expect(
                new URL(page.url()).searchParams.get("calendarSemester"),
              ).toBe(String(semester.id));
              await expect(
                page
                  .locator(
                    `a[href="/catalog/sections/${fixture.section.jwId}"]`,
                  )
                  .filter({ visible: true })
                  .first(),
              ).toBeVisible();
            }
            if (path === "exams") {
              await page
                .getByRole("group", { name: "Exams", exact: true })
                .getByRole("radio", { name: "All", exact: true })
                .click();
              await expect(
                page
                  .locator(
                    `a[href="/catalog/sections/${fixture.section.jwId}"]`,
                  )
                  .filter({ visible: true })
                  .first(),
              ).toBeVisible();
            }
          }
        }
      }
      await client.authorize();
      if (feature === "workspace.overview") {
        const snapshot = await client.callTool({
          name: "workspace_snapshot_get",
          arguments: { atTime: "2026-04-29T09:30:00+08:00" },
        });
        expect(snapshot.isError).not.toBe(true);
        expect(parseTextContent(snapshot)).toMatchObject({
          subscriptions: { totalCount: 1, currentSemesterCount: 0 },
        });
      }
      if (feature === "workspace.subscription") {
        const list = await client.callTool({
          name: "workspace_subscription_list",
          arguments: { mode: "full" },
        });
        expect(list.isError).not.toBe(true);
        expect(parseTextContent(list)).toMatchObject({
          sections: [{ id: fixture.section.id, semester: { id: semester.id } }],
        });
      }
      for (const [name, key, owner] of [
        ["workspace_homework_list", "homeworks", "workspace.homework"],
        ["workspace_schedule_list", "schedules", "workspace.schedule"],
        ["workspace_exam_list", "exams", "workspace.exam"],
      ] as const) {
        if (owner !== feature) continue;
        const result = await client.callTool({
          name,
          arguments: { semesterId: semester.id, mode: "full" },
        });
        expect(result.isError, `${name}: ${JSON.stringify(result)}`).not.toBe(
          true,
        );
        const body = parseTextContent(result) as Record<
          string,
          { section: { id: number } }[]
        >;
        expect(body[key]).toHaveLength(1);
        expect(body[key][0].section.id).toBe(fixture.section.id);
        const otherTerm = await client.callTool({
          name,
          arguments: { semesterId: fixture.section.semesterId, mode: "full" },
        });
        expect(otherTerm.isError).not.toBe(true);
        expect(
          (parseTextContent(otherTerm) as Record<string, unknown[]>)[key],
        ).toEqual([]);
      }
      return client.checks(expectedState);
    });
  });
}
