import { describe, expect, it } from "vitest";
import {
  extractMcpToolCallNamesFromRequest,
  extractMcpToolNamesFromRequest,
  getMcpWriteRateLimitAction,
  getMcpWriteRateLimitTier,
  getRequiredMcpScopes,
  isMcpWriteTool,
} from "@/lib/mcp/tool-scopes";
import { restReadScope, restWriteScope } from "@/lib/oauth/constants";

describe("getRequiredMcpScopes", () => {
  it("maps a single tool to its feature scope", () => {
    expect(getRequiredMcpScopes("workspace_todo_list")).toEqual([
      restReadScope("todo"),
    ]);
    expect(getRequiredMcpScopes("workspace_todo_create")).toEqual([
      restWriteScope("todo"),
    ]);
  });

  it("returns multiple scopes for cross-cutting tools", () => {
    expect(getRequiredMcpScopes("workspace_schedule_next").sort()).toEqual(
      [restReadScope("dashboard"), restReadScope("schedule")].sort(),
    );
  });

  it("unions required scopes for multiple tool names", () => {
    expect(
      getRequiredMcpScopes([
        "workspace_todo_list",
        "community_comment_create",
      ]).sort(),
    ).toEqual([restWriteScope("comment"), restReadScope("todo")].sort());
  });

  it("returns an empty array for unmapped tools", () => {
    expect(getRequiredMcpScopes("unknown_tool")).toEqual([]);
    expect(getRequiredMcpScopes(["unknown_tool", "also_unknown"])).toEqual([]);
  });

  it("returns an empty array when no tool name is provided", () => {
    expect(getRequiredMcpScopes(undefined)).toEqual([]);
  });

  it("covers every major feature area", () => {
    expect(getRequiredMcpScopes("account_profile_get")).toEqual([
      restReadScope("me"),
    ]);
    expect(getRequiredMcpScopes("workspace_snapshot_get")).toEqual([
      restReadScope("dashboard"),
    ]);
    expect(getRequiredMcpScopes("catalog_bus_departure_next")).toEqual([
      restReadScope("bus"),
    ]);
    expect(getRequiredMcpScopes("catalog_course_search")).toEqual([
      restReadScope("course"),
    ]);
    expect(getRequiredMcpScopes("catalog_section_get")).toEqual([
      restReadScope("section"),
    ]);
    expect(getRequiredMcpScopes("catalog_teacher_search")).toEqual([
      restReadScope("teacher"),
    ]);
    expect(getRequiredMcpScopes("catalog_schedule_list")).toEqual([
      restReadScope("schedule"),
    ]);
    expect(getRequiredMcpScopes("workspace_exam_list")).toEqual([
      restReadScope("exam"),
    ]);
    expect(getRequiredMcpScopes("community_section_homework_create")).toEqual([
      restWriteScope("homework"),
    ]);
    expect(getRequiredMcpScopes("workspace_subscription_add")).toEqual([
      restWriteScope("subscription"),
    ]);
    expect(getRequiredMcpScopes("workspace_calendar_event_list")).toEqual([
      restReadScope("schedule"),
    ]);
    expect(getRequiredMcpScopes("community_comment_create")).toEqual([
      restWriteScope("comment"),
    ]);
    expect(getRequiredMcpScopes("community_description_get")).toEqual([
      restReadScope("description"),
    ]);
    expect(getRequiredMcpScopes("workspace_upload_list")).toEqual([
      restReadScope("upload"),
    ]);
  });

  it("maps mutation tools to shared feature-action budgets", () => {
    expect(isMcpWriteTool("workspace_todo_create")).toBe(true);
    expect(getMcpWriteRateLimitAction("workspace_todo_create")).toBe(
      "todo:write",
    );
    expect(getMcpWriteRateLimitTier("workspace_todo_create")).toBe("write");

    expect(isMcpWriteTool("workspace_subscription_import")).toBe(true);
    expect(getMcpWriteRateLimitAction("workspace_subscription_import")).toBe(
      "subscription:batch-write",
    );
    expect(getMcpWriteRateLimitTier("workspace_subscription_import")).toBe(
      "batch",
    );

    expect(isMcpWriteTool("workspace_todo_list")).toBe(false);
  });
});

describe("extractMcpToolNamesFromRequest", () => {
  it("extracts a single tools/call name", async () => {
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "workspace_todo_list", arguments: {} },
      }),
    });

    expect(await extractMcpToolNamesFromRequest(request)).toEqual([
      "workspace_todo_list",
    ]);
  });

  it("extracts distinct names from a batch", async () => {
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "workspace_todo_list" },
        },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "community_comment_create" },
        },
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "workspace_todo_list" },
        },
      ]),
    });

    const names = await extractMcpToolNamesFromRequest(request);
    expect(names.sort()).toEqual([
      "community_comment_create",
      "workspace_todo_list",
    ]);
  });

  it("preserves duplicate mutation calls for per-entry batch accounting", async () => {
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "workspace_todo_create" },
        },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "workspace_todo_create" },
        },
      ]),
    });

    await expect(extractMcpToolCallNamesFromRequest(request)).resolves.toEqual([
      "workspace_todo_create",
      "workspace_todo_create",
    ]);
  });

  it("ignores non-tools/call messages", async () => {
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }),
    });

    expect(await extractMcpToolNamesFromRequest(request)).toEqual([]);
  });

  it("returns an empty array for non-POST requests", async () => {
    const request = new Request("https://life.example/api/mcp", {
      method: "GET",
    });

    expect(await extractMcpToolNamesFromRequest(request)).toEqual([]);
  });

  it("returns an empty array for invalid JSON bodies", async () => {
    const request = new Request("https://life.example/api/mcp", {
      method: "POST",
      body: "not-json",
    });

    expect(await extractMcpToolNamesFromRequest(request)).toEqual([]);
  });
});
