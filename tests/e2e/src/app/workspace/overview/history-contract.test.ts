import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, test } from "@playwright/test";
import { createCalendarContractFixture } from "../../../../utils/calendar-contract";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../../utils/workspace-task-filters";
import { issueAccessToken, parseTextContent } from "../../api/mcp/helpers";

test("overview.historical-subscriptions-remain-discoverable", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const fixture = await createCalendarContractFixture();
  const semester = await withE2ePrisma(async (db) => {
    const past = await db.semester.create({
      data: {
        jwId: fixture.section.jwId + 40,
        nameCn: "历史验证学期",
        code: `HISTORY-${fixture.course.code}`,
        startDate: new Date("2025-09-01T00:00:00Z"),
        endDate: new Date("2026-01-15T00:00:00Z"),
      },
    });
    await db.section.update({
      where: { id: fixture.section.id },
      data: { semesterId: past.id },
    });
    await db.schedule.updateMany({
      where: { sectionId: fixture.section.id },
      data: { date: new Date("2026-01-07T00:00:00Z") },
    });
    await db.exam.updateMany({
      where: { sectionId: fixture.section.id },
      data: { examDate: new Date("2026-01-07T00:00:00Z") },
    });
    await db.homework.update({
      where: { id: fixture.homework.id },
      data: { submissionDueAt: new Date("2026-01-07T12:00:00+08:00") },
    });
    return past;
  });
  let clientId: string | undefined;
  const client = new Client({ name: "overview-history", version: "1" });
  try {
    await page.context().clearCookies();
    await page
      .context()
      .addCookies([
        await createSignedSessionCookie(fixture.users[0].id),
        { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
      ]);
    const overviewUrl =
      "/workspace/overview?snapshotAt=2026-04-29T09%3A30%3A00%2B08%3A00";
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
        await context.getByRole("link", { name: label, exact: true }).click();
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
          expect(new URL(page.url()).searchParams.get("calendarSemester")).toBe(
            String(semester.id),
          );
          try {
            await expect(
              page
                .locator(`a[href="/catalog/sections/${fixture.section.jwId}"]`)
                .filter({ visible: true })
                .first(),
            ).toBeVisible();
          } catch (error) {
            await page.screenshot({
              path: `/tmp/life-spec-business-history-calendar-${width}.png`,
              fullPage: true,
            });
            throw error;
          }
          await page.screenshot({
            path: `/tmp/life-spec-business-history-calendar-${width}.png`,
            fullPage: true,
          });
        }
        if (path === "exams") {
          await page
            .getByRole("group", { name: "Exams", exact: true })
            .getByRole("radio", { name: "All", exact: true })
            .click();
          await expect(
            page
              .locator(`a[href="/catalog/sections/${fixture.section.jwId}"]`)
              .filter({ visible: true })
              .first(),
          ).toBeVisible();
        }
      }
    }
    const scope =
      "workspace.overview:read workspace.subscription:read workspace.homework:read workspace.schedule:read workspace.exam:read";
    const resource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
    const token = await issueAccessToken(page, request, {
      scope,
      clientScopes: scope.split(" "),
      resource,
    });
    clientId = token.clientId;
    await client.connect(
      new StreamableHTTPClientTransport(new URL(resource), {
        requestInit: {
          headers: { Authorization: `Bearer ${token.accessToken}` },
        },
      }),
    );
    const snapshot = await client.callTool({
      name: "workspace_snapshot_get",
      arguments: { atTime: "2026-04-29T09:30:00+08:00" },
    });
    expect(snapshot.isError).not.toBe(true);
    expect(parseTextContent(snapshot)).toMatchObject({
      subscriptions: { totalCount: 1, currentSemesterCount: 0 },
    });
    const list = await client.callTool({
      name: "workspace_subscription_list",
      arguments: { mode: "full" },
    });
    expect(list.isError).not.toBe(true);
    expect(parseTextContent(list)).toMatchObject({
      sections: [{ id: fixture.section.id, semester: { id: semester.id } }],
    });
    for (const [name, key] of [
      ["workspace_homework_list", "homeworks"],
      ["workspace_schedule_list", "schedules"],
      ["workspace_exam_list", "exams"],
    ] as const) {
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
  } finally {
    await client.close();
    if (clientId)
      await withE2ePrisma((db) =>
        db.oAuthClient.delete({ where: { clientId } }),
      );
    await fixture.cleanup();
    await withE2ePrisma((db) =>
      db.semester.delete({ where: { id: semester.id } }),
    );
  }
});
