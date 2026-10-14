import type { McpServer } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { query, requireAuth } = vi.hoisted(() => ({
  query: vi.fn(),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/auth/api-auth", () => ({ requireAuth }));
vi.mock("@/lib/db/prisma", () => ({ withUserDbContext: vi.fn() }));
vi.mock("@/lib/db/runtime-database-snapshot", () => ({
  withRuntimeDatabaseSnapshot: async (
    _database: string,
    _limits: unknown,
    action: (connection: unknown) => unknown,
  ) => action({ query }),
}));

import { getTodosRoute } from "@/lib/api/routes/todos";
import { listMyTodosInputSchema } from "@/lib/mcp/tools/workspace/profile-tool-helpers";
import { listMyTodosAction } from "@/lib/mcp/tools/workspace/profile-tool-todo-list-action";
import { registerProfileTools } from "@/lib/mcp/tools/workspace/profile-tools";

beforeEach(() => {
  vi.clearAllMocks();
  query.mockImplementation(async (sql: string) => ({
    rows: sql.includes("AS incomplete")
      ? [{ completed: 0, incomplete: 0, overdue: 0 }]
      : [],
  }));
  requireAuth.mockResolvedValue({ userId: "owner" });
});

describe("REST todo list limit", () => {
  const request = (limit?: number) =>
    new Request(
      `https://example.test/api/workspace/todos${limit === undefined ? "" : `?limit=${limit}`}`,
    );

  it.each([
    [undefined, 100],
    [1, 1],
    [200, 200],
  ] as const)("accepts limit %s and reads %s rows", async (limit, expected) => {
    expect((await getTodosRoute(request(limit))).status).toBe(200);
    const lists = query.mock.calls.filter(([sql]) => sql.includes("ORDER BY"));
    expect(lists).toHaveLength(1);
    expect(lists[0][1]).toEqual(["owner", null, null, null, null, expected]);
  });
  it.each([0, 201, 1.5])(
    "rejects limit %s before any data read",
    async (limit) => {
      expect((await getTodosRoute(request(limit))).status).toBe(400);
      expect(query).not.toHaveBeenCalled();
    },
  );
});

describe("MCP todo list limit", () => {
  const schema = z.object(listMyTodosInputSchema);
  it("registers the validated schema and actual handler", () => {
    const registerTool = vi.fn();
    registerProfileTools({ registerTool } as unknown as McpServer);
    const registration = registerTool.mock.calls.find(
      ([name]) => name === "workspace_todo_list",
    );
    expect(registration?.[1].inputSchema).toBe(listMyTodosInputSchema);
    expect(registration?.[2]).toBe(listMyTodosAction);
  });
  it.each([
    [undefined, 50],
    [1, 1],
    [200, 200],
  ] as const)("accepts limit %s and reads %s rows", async (limit, expected) => {
    await listMyTodosAction(
      schema.parse(limit === undefined ? {} : { limit }),
      {
        http: {
          authInfo: {
            token: "test",
            clientId: "unit",
            scopes: ["workspace.todo:read"],
            extra: { userId: "owner" },
          },
        },
      } as Parameters<typeof listMyTodosAction>[1],
    );
    const lists = query.mock.calls.filter(([sql]) => sql.includes("ORDER BY"));
    expect(lists).toHaveLength(1);
    expect(lists[0][1]).toEqual(["owner", false, null, null, null, expected]);
  });
  it.each([0, 201, 1.5])("rejects limit %s", (limit) => {
    expect(schema.safeParse({ limit }).success).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
});
