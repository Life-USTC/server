import { describe, expect, it } from "vitest";
import {
  extractMcpToolNamesFromRequest,
  getRequiredMcpScopes,
} from "@/lib/mcp/tool-scopes";
import { restReadScope, restWriteScope } from "@/lib/oauth/constants";

describe("getRequiredMcpScopes", () => {
  it("maps a single tool to its feature scope", () => {
    expect(getRequiredMcpScopes("list_my_todos")).toEqual([
      restReadScope("todo"),
    ]);
    expect(getRequiredMcpScopes("create_my_todo")).toEqual([
      restWriteScope("todo"),
    ]);
  });

  it("returns multiple scopes for cross-cutting tools", () => {
    expect(getRequiredMcpScopes("get_next_class").sort()).toEqual(
      [restReadScope("dashboard"), restReadScope("schedule")].sort(),
    );
  });

  it("unions required scopes for multiple tool names", () => {
    expect(
      getRequiredMcpScopes(["list_my_todos", "create_comment"]).sort(),
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
    expect(getRequiredMcpScopes("get_my_profile")).toEqual([
      restReadScope("me"),
    ]);
    expect(getRequiredMcpScopes("get_my_dashboard")).toEqual([
      restReadScope("dashboard"),
    ]);
    expect(getRequiredMcpScopes("get_next_buses")).toEqual([
      restReadScope("bus"),
    ]);
    expect(getRequiredMcpScopes("search_courses")).toEqual([
      restReadScope("course"),
    ]);
    expect(getRequiredMcpScopes("get_section_by_jw_id")).toEqual([
      restReadScope("section"),
    ]);
    expect(getRequiredMcpScopes("search_teachers")).toEqual([
      restReadScope("teacher"),
    ]);
    expect(getRequiredMcpScopes("query_schedules")).toEqual([
      restReadScope("schedule"),
    ]);
    expect(getRequiredMcpScopes("list_my_exams")).toEqual([
      restReadScope("exam"),
    ]);
    expect(getRequiredMcpScopes("create_homework_on_section")).toEqual([
      restWriteScope("homework"),
    ]);
    expect(getRequiredMcpScopes("subscribe_section_by_jw_id")).toEqual([
      restWriteScope("subscription"),
    ]);
    expect(getRequiredMcpScopes("list_my_calendar_events")).toEqual([
      restReadScope("schedule"),
    ]);
    expect(getRequiredMcpScopes("create_comment")).toEqual([
      restWriteScope("comment"),
    ]);
    expect(getRequiredMcpScopes("get_description")).toEqual([
      restReadScope("description"),
    ]);
    expect(getRequiredMcpScopes("list_my_uploads")).toEqual([
      restReadScope("upload"),
    ]);
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
        params: { name: "list_my_todos", arguments: {} },
      }),
    });

    expect(await extractMcpToolNamesFromRequest(request)).toEqual([
      "list_my_todos",
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
          params: { name: "list_my_todos" },
        },
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "create_comment" },
        },
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "list_my_todos" },
        },
      ]),
    });

    const names = await extractMcpToolNamesFromRequest(request);
    expect(names.sort()).toEqual(["create_comment", "list_my_todos"]);
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
