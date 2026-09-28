import { describe } from "vitest";
import * as fixtures from "./_harness";
import { mcpTest } from "./_harness/context";

const toolTest = mcpTest.extend(
  "owner",
  fixtures.academicActorFixture({
    emailPrefix: "mcp-actionable-errors",
    name: "[integration-test] actionable errors",
  }),
);

describe("MCP domain failure contracts", () => {
  toolTest(
    "mcp.actionable-errors",
    { timeout: 30_000 },
    async ({ owner, expect }) => {
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
          { dateFrom: fixtures.SEED_DATE },
          "invalid_range",
        ],
        [
          "community_section_homework_create",
          {
            sectionJwId: fixtures.DEV_SEED.section.jwId,
            title: "dates reversed",
            submissionStartAt: fixtures.SEED_PLUS_ELEVEN_DAYS,
            submissionDueAt: fixtures.SEED_DATE,
          },
          "invalid_dates",
        ],
        [
          "community_section_homework_update",
          {
            homeworkId: missingId,
            title: "dates reversed",
            submissionStartAt: fixtures.SEED_PLUS_ELEVEN_DAYS,
            submissionDueAt: fixtures.SEED_DATE,
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
    },
  );
});
