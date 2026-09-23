/**
 * MCP seeded tools — OAuth PKCE token 可连接 /api/mcp 并调用全部种子工具
 */
import { expect, test } from "@playwright/test";
import { closeSeededMcpSession, openSeededMcpSession } from "./seeded-session";

test.describe("/api/mcp - 种子工具覆盖", () => {
  test.describe.configure({ mode: "serial" });

  test("OAuth PKCE token 可连接 /api/mcp 并调用全部种子工具", async ({
    page,
    request,
  }) => {
    const session = await openSeededMcpSession(page, request);
    const mcpClient = session.client;
    try {
      const metadataResponse = await request.get(
        "/.well-known/oauth-authorization-server",
      );
      expect(metadataResponse.status()).toBe(200);

      const tools = await mcpClient.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          "account_profile_get",
          "community_user_get",
          "workspace_todo_list",
          "workspace_todo_create",
          "workspace_todo_update",
          "workspace_todo_delete",
          "workspace_snapshot_get",
          "workspace_schedule_next",
          "workspace_deadline_list",
          "workspace_homework_list",
          "workspace_homework_completion_set",
          "workspace_upload_list",
          "workspace_upload_rename",
          "workspace_upload_delete",
          "workspace_schedule_list",
          "workspace_exam_list",
          "workspace_overview_get",
          "workspace_calendar_timeline_get",
          "catalog_course_search",
          "catalog_section_match_preview",
          "workspace_calendar_feed_get",
          "workspace_subscription_import",
          "catalog_section_get",
          "community_section_homework_list",
          "community_section_homework_create",
          "community_section_homework_update",
          "community_section_homework_delete",
          "catalog_section_schedule_list",
          "catalog_section_exam_list",
          "catalog_bus_timetable_get",
          "catalog_bus_route_list",
          "catalog_bus_route_get",
          "catalog_bus_route_search",
          "catalog_bus_departure_next",
          "community_comment_list",
          "community_comment_get",
          "community_comment_replies",
          "community_comment_create",
          "community_comment_update",
          "community_comment_delete",
          "community_comment_reaction_add",
          "community_comment_reaction_remove",
        ]),
      );
      expect(tools.tools.map((tool) => tool.name)).not.toEqual(
        expect.arrayContaining(["set_comment_reaction"]),
      );
      for (const name of [
        "community_section_homework_create",
        "community_section_homework_update",
      ]) {
        const description =
          tools.tools.find((tool) => tool.name === name)?.description ?? "";
        expect(description).toContain("Advisory style guide only");
        expect(description).toContain("never reject a request for formatting");
        expect(description).toContain("第{N}次作业");
        expect(description).toContain("{主题}作业");
        expect(description).toContain("第一章作业");
        expect(description).toMatch(/题目.*提交方式.*提交地址.*备注/);
      }
    } finally {
      await closeSeededMcpSession(page, session);
    }
  });
});
