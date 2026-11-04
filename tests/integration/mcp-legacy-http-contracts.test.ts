import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { expect } from "vitest";
import { call, mcpHttpTest as it, payload } from "../shared/mcp-http-fixture";

it("mcp.legacy-stateless-clients", { tags: ["@MCP/MCP"] }, async ({ http }) =>
  http.run(async () => {
    const search = `mcp-${crypto.randomUUID()}`;
    await http.db.course.create({
      data: {
        jwId: 18424001,
        code: "MCP-COMPAT",
        nameCn: search,
      },
    });
    // No modern-envelope helper: exercise the bytes existing clients send.
    for (const version of ["2025-03-26", "2025-06-18", "2025-11-25"]) {
      const headers = {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": version,
      };
      const post = (body: unknown, authorization?: string) =>
        http.fetch(`${http.origin}/api/mcp`, {
          method: "POST",
          headers: { ...headers, ...(authorization ? { authorization } : {}) },
          body: JSON.stringify(body),
        });
      const initialize = await post({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: version,
          capabilities: {},
          clientInfo: { name: "legacy-wire-contract", version: "1" },
        },
      });
      expect(initialize.status).toBe(200);
      expect(initialize.headers.get("mcp-session-id")).toBeNull();
      expect(await payload(initialize)).toMatchObject({
        result: {
          protocolVersion: version,
          serverInfo: { name: "life-ustc-mcp" },
          capabilities: { tools: {} },
        },
      });
      const initialized = await post({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });
      expect(initialized.status).toBe(202);
      await initialized.text();
      const list = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" });
      expect(list.status).toBe(200);
      const tools = (await payload(list)).result.tools;
      expect(tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "catalog_course_search" }),
          expect.objectContaining({ name: "workspace_todo_create" }),
        ]),
      );
      const publicRead = await post(
        call("catalog_course_search", {
          search,
          limit: 1,
        }),
      );
      expect(publicRead.status).toBe(200);
      expect((await payload(publicRead)).result).toMatchObject({
        structuredContent: {
          success: true,
          data: [expect.objectContaining({ code: "MCP-COMPAT" })],
          pagination: { total: 1 },
        },
      });
      const denied = await post(
        call("workspace_todo_create", { title: "must not write" }),
      );
      expect(denied.status).toBe(401);
      await denied.text();
      expect(await http.db.todo.count({ where: { userId: http.userId } })).toBe(
        0,
      );
      const narrowToken = await http.sign({ scopes: ["workspace.todo:read"] });
      const deniedScope = await post(
        call("workspace_todo_create", { title: "scope must not write" }),
        `Bearer ${narrowToken}`,
      );
      expect(deniedScope.status).toBe(403);
      await deniedScope.text();
      expect(await http.db.todo.count({ where: { userId: http.userId } })).toBe(
        0,
      );
      const title = `legacy-${version}`;
      const created = await post(
        call("workspace_todo_create", { title }),
        `Bearer ${http.token}`,
      );
      expect(created.status).toBe(200);
      expect((await payload(created)).result.isError).not.toBe(true);
      expect(
        await http.db.todo.count({ where: { userId: http.userId, title } }),
      ).toBe(1);
      await http.db.todo.deleteMany({ where: { userId: http.userId } });
    }
  }),
);

it("mcp.default-sdk-client", { tags: ["@MCP/MCP"] }, async ({ http }) =>
  http.run(async () => {
    const search = `mcp-${crypto.randomUUID()}`;
    await http.db.course.create({
      data: {
        jwId: 18424002,
        code: "MCP-SDK",
        nameCn: search,
      },
    });
    // Deliberately omit versionNegotiation: this is the official SDK default.
    const client = new Client({ name: "default-sdk-contract", version: "1" });
    const transport = new StreamableHTTPClientTransport(
      new URL(`${http.origin}/api/mcp`),
      { fetch: http.fetch },
    );
    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(
        tools.tools.some((tool) => tool.name === "catalog_course_search"),
      ).toBe(true);
      const result = await client.callTool({
        name: "catalog_course_search",
        arguments: { search, limit: 1 },
      });
      expect(result.isError).not.toBe(true);
      expect(result.content).toEqual(expect.any(Array));
      expect(result.structuredContent).toMatchObject({
        success: true,
        data: [expect.objectContaining({ code: "MCP-SDK" })],
        pagination: { total: 1 },
      });
    } finally {
      await client.close();
    }
  }),
);
