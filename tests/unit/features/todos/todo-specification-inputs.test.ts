import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { todoExpectation } from "../../../shared/specifications/todo";

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

describe("Todo specification input behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
    queryRaw.mockResolvedValue([
      { completed: 0n, incomplete: 0n, overdue: 0n, due_soon: 0n },
    ]);
    requireAuth.mockResolvedValue({ userId: "spec-owner" });
  });

  it("enforces rest todo list limits and default", async () => {
    const rule = await todoExpectation("todo.rest-list-limit", "numeric_input");
    const { getTodosRoute } = await import("@/lib/api/routes/todos");
    const [method, path] = rule.operation.split(" ");
    const request = (limit?: number) =>
      new Request(
        `https://example.test${path}${limit === undefined ? "" : `?${rule.input}=${limit}`}`,
        { method },
      );
    for (const limit of [undefined, rule.minimum, rule.maximum]) {
      const response = await getTodosRoute(request(limit));
      expect(response.status).toBe(200);
      expect(findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: limit ?? rule.default }),
      );
    }
    findMany.mockClear();
    for (const limit of [rule.minimum - 1, rule.maximum + 1]) {
      expect((await getTodosRoute(request(limit))).status).toBe(400);
    }
    expect(findMany).not.toHaveBeenCalled();
    const fractionalResponse = await getTodosRoute(request(rule.minimum + 0.5));
    expect(fractionalResponse.status).toBe(rule.integer ? 400 : 200);
    expect(findMany).toHaveBeenCalledTimes(rule.integer ? 0 : 1);
  });

  it("enforces mcp todo list limits and default", async () => {
    const rule = await todoExpectation("todo.mcp-list-limit", "numeric_input");
    const { listMyTodosInputSchema } = await import(
      "@/lib/mcp/tools/workspace/profile-tool-helpers"
    );
    const { listMyTodosAction } = await import(
      "@/lib/mcp/tools/workspace/profile-tool-todo-list-action"
    );
    const { registerProfileTools } = await import(
      "@/lib/mcp/tools/workspace/profile-tools"
    );
    const registerTool = vi.fn();
    registerProfileTools({ registerTool } as unknown as McpServer);
    const registration = registerTool.mock.calls.find(
      ([name]) => name === rule.operation,
    );
    expect(
      registration,
      "specified MCP tool must register the tested schema and handler",
    ).toBeDefined();
    expect(registration?.[1].inputSchema).toBe(listMyTodosInputSchema);
    expect(registration?.[2]).toBe(listMyTodosAction);
    const schema = z.object(listMyTodosInputSchema);
    for (const limit of [undefined, rule.minimum, rule.maximum]) {
      const input = schema.parse(
        limit === undefined ? {} : { [rule.input]: limit },
      );
      await listMyTodosAction(input, {
        authInfo: {
          token: "test",
          clientId: "spec",
          scopes: ["workspace.todo:read"],
          extra: { userId: "spec-owner" },
        },
      } as Parameters<typeof listMyTodosAction>[1]);
      expect(findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: limit ?? rule.default }),
      );
    }
    for (const limit of [rule.minimum - 1, rule.maximum + 1]) {
      expect(schema.safeParse({ [rule.input]: limit }).success).toBe(false);
    }
    expect(schema.safeParse({ [rule.input]: rule.minimum + 0.5 }).success).toBe(
      !rule.integer,
    );
  });
});
