import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { findMany, queryRaw, requireAuth } = vi.hoisted(() => ({
  findMany: vi.fn(),
  queryRaw: vi.fn(),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/auth/api-auth", () => ({ requireAuth }));
vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: async (
    _userId: string,
    action: (tx: unknown) => unknown,
  ) => action({ $queryRaw: queryRaw, todo: { findMany } }),
}));

import { getTodosRoute } from "@/lib/api/routes/todos";
import { listMyTodosInputSchema } from "@/lib/mcp/tools/workspace/profile-tool-helpers";
import { listMyTodosAction } from "@/lib/mcp/tools/workspace/profile-tool-todo-list-action";
import { registerProfileTools } from "@/lib/mcp/tools/workspace/profile-tools";

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
  queryRaw.mockResolvedValue([
    { completed: 0n, incomplete: 0n, overdue: 0n, due_soon: 0n },
  ]);
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
    expect(findMany).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ take: expected }),
    );
  });
  it.each([0, 201, 1.5])(
    "rejects limit %s before any data read",
    async (limit) => {
      expect((await getTodosRoute(request(limit))).status).toBe(400);
      expect(findMany).not.toHaveBeenCalled();
      expect(queryRaw).not.toHaveBeenCalled();
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
        authInfo: {
          token: "test",
          clientId: "unit",
          scopes: ["workspace.todo:read"],
          extra: { userId: "owner" },
        },
      } as Parameters<typeof listMyTodosAction>[1],
    );
    expect(findMany).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ take: expected }),
    );
  });
  it.each([0, 201, 1.5])("rejects limit %s", (limit) => {
    expect(schema.safeParse({ limit }).success).toBe(false);
    expect(findMany).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
