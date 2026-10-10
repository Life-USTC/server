import { describe } from "vitest";
import { isolatedMcpTest as toolTest } from "./_harness/isolated-context";

const anchorDate = "2026-04-29";
const elevenDaysLater = "2026-05-10";

describe("MCP domain failure contracts", () => {
  toolTest(
    "mcp.actionable-errors",
    { tags: ["@MCP/MCP"], timeout: 30_000 },
    async ({
      mcpWorkflow,
      mcpActor: owner,
      mcpSection,
      isolatedDatabase,
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        await isolatedDatabase.owner.$transaction(async (db) => {
          await db.userSectionSubscription.create({
            data: { userId: owner.userId, sectionId: mcpSection.id },
          });
          await db.todo.create({
            data: {
              userId: owner.userId,
              title: "Existing todo must survive rejected writes",
            },
          });
          await db.homework.create({
            data: {
              sectionId: mcpSection.id,
              createdById: owner.userId,
              title: "Existing homework must survive rejected writes",
            },
          });
        });
        const persistedState = () =>
          isolatedDatabase.owner.$transaction(async (db) => ({
            users: await db.user.findMany({ orderBy: { id: "asc" } }),
            subscriptions: await db.userSectionSubscription.findMany({
              orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
            }),
            todos: await db.todo.findMany({ orderBy: { id: "asc" } }),
            homeworks: await db.homework.findMany({ orderBy: { id: "asc" } }),
            completions: await db.homeworkCompletion.findMany({
              orderBy: [{ userId: "asc" }, { homeworkId: "asc" }],
            }),
            comments: await db.comment.findMany({ orderBy: { id: "asc" } }),
            descriptions: await db.description.findMany({
              orderBy: { id: "asc" },
            }),
            audits: await db.auditLog.findMany({ orderBy: { id: "asc" } }),
          }));
        const unchanged = await persistedState();
        const missingId = "missing-private-resource";
        const invalidSecret = "credential-that-must-not-be-echoed";
        const names = new Set(
          (await owner.client.listTools()).tools.map((tool) => tool.name),
        );
        const cases: Array<[string, Record<string, unknown>, string]> = [
          [
            "workspace_todo_create",
            { title: "bad date", dueAt: invalidSecret },
            "invalid_date",
          ],
          [
            "workspace_schedule_list",
            { dateFrom: invalidSecret },
            "invalid_date",
          ],
          ["workspace_exam_list", { dateTo: invalidSecret }, "invalid_date"],
          [
            "workspace_calendar_event_list",
            { dateFrom: anchorDate },
            "invalid_range",
          ],
          [
            "community_section_homework_create",
            {
              sectionJwId: mcpSection.jwId,
              title: "dates reversed",
              submissionStartAt: elevenDaysLater,
              submissionDueAt: anchorDate,
            },
            "invalid_dates",
          ],
          [
            "community_section_homework_update",
            {
              homeworkId: missingId,
              title: "dates reversed",
              submissionStartAt: elevenDaysLater,
              submissionDueAt: anchorDate,
            },
            "date",
          ],
          [
            "workspace_todo_update",
            { id: missingId, title: "missing" },
            "not_found",
          ],
          ["workspace_todo_delete", { id: missingId }, "not_found"],
          [
            "workspace_subscription_kind_update",
            { jwId: 999_999_999, kind: "auditor" },
            "not_found",
          ],
          [
            "workspace_homework_completion_set",
            { homeworkId: missingId, completed: true },
            "not_found",
          ],
          [
            "community_section_homework_update",
            { homeworkId: missingId, title: "missing" },
            "not_found",
          ],
          [
            "community_section_homework_list",
            { sectionJwId: 999_999_999 },
            "not_found",
          ],
          ["catalog_section_get", { jwId: 999_999_999 }, "not_found"],
          [
            "catalog_section_schedule_list",
            { sectionJwId: 999_999_999 },
            "not_found",
          ],
          [
            "catalog_section_exam_list",
            { sectionJwId: 999_999_999 },
            "not_found",
          ],
          [
            "catalog_section_calendar_feed_get",
            { jwId: 999_999_999 },
            "not_found",
          ],
          ["catalog_course_get", { jwId: 999_999_999 }, "not_found"],
          ["catalog_teacher_get", { id: 999_999_999 }, "not_found"],
          ["catalog_young_event_get", { youngId: missingId }, "not_found"],
          [
            "catalog_young_organizer_get",
            { organizerId: missingId },
            "not_found",
          ],
          ["catalog_bus_route_get", { routeId: 999_999_999 }, "not_found"],
          ["community_comment_get", { commentId: missingId }, "not_found"],
        ];
        for (const mode of ["default", "full"]) {
          for (const [name, args, error] of cases) {
            expect(names.has(name), name).toBe(true);
            const result = await owner.client.call(name, { ...args, mode });
            expect(result.success, name).toBe(false);
            expect(result.error, name).toBe(error);
            expect(typeof result.message, name).toBe("string");
            expect(String(result.message).length, name).toBeGreaterThan(3);
            expect(JSON.stringify(result), name).not.toContain(invalidSecret);
            expect(
              await persistedState(),
              `${name} ${mode}: rejection has no domain or audit changes`,
            ).toEqual(unchanged);
            if (result.hint !== undefined) {
              expect(typeof result.hint).toBe("string");
              const referenced =
                String(result.hint).match(
                  /\b(?:workspace|catalog|community|account)_[a-z_]+\b/g,
                ) ?? [];
              for (const toolName of referenced)
                expect(names.has(toolName), `${name} hint ${toolName}`).toBe(
                  true,
                );
            }
          }
        }
      }),
  );
});
