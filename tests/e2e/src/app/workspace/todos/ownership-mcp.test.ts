import { parseTextContent } from "../../api/mcp/helpers";
import { expect, roles, browserTest as test } from "./_ownership";

for (const role of roles)
  test.describe(`todo ownership OAuth MCP ${role}`, () => {
    test.use({ ownerRole: role });
    test("consumer returns only owned rows", { tag: "@Todo/MCP" }, async ({
      ownership: f,
    }) => {
      await f.run(
        async () => {
          const client = await f.mcp();
          const result = parseTextContent(
            await client.callTool({
              name: "workspace_todo_list",
              arguments: { mode: "full", includeCompleted: true },
            }),
          ) as { todos: { id: string }[] };
          expect(result.todos.map((todo) => todo.id)).toEqual([
            f.actor.todo.id,
          ]);
          await f.unchanged();
        },
        { calendarRebuilds: 0 },
      );
    });
    test("foreign update and delete are rejected without effects", {
      tag: "@Todo/MCP",
    }, async ({ ownership: f }) => {
      await f.run(
        async () => {
          const client = await f.mcp();
          for (const name of [
            "workspace_todo_update",
            "workspace_todo_delete",
          ]) {
            const result = parseTextContent(
              await client.callTool({
                name,
                arguments: {
                  id: f.other.todo.id,
                  title: "MCP foreign overwrite",
                },
              }),
            );
            expect(result).toMatchObject({
              success: false,
              message: "Todo not found",
            });
            await f.unchanged();
          }
        },
        { calendarRebuilds: 0 },
      );
    });
    test("owner create ignores forged ownership", { tag: "@Todo/MCP" }, async ({
      ownership: f,
    }) => {
      await f.run(
        async () => {
          const client = await f.mcp();
          const response = await client.callTool({
            name: "workspace_todo_create",
            arguments: { title: "MCP owned", userId: f.other.id },
          });
          expect(response.isError).not.toBe(true);
          const created = parseTextContent(response);
          expect(created).toEqual({ id: expect.any(String), success: true });
          if (typeof created.id !== "string")
            throw new Error("Missing created todo ID");
          expect(await f.stored(created.id)).toEqual({
            id: created.id,
            userId: f.actor.id,
            title: "MCP owned",
            content: null,
            completed: false,
            priority: "medium",
            dueAt: null,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          });
          await f.unchanged([created.id]);
        },
        { calendarRebuilds: 1 },
      );
    });
    test("owner update preserves authenticated ownership", {
      tag: "@Todo/MCP",
    }, async ({ ownership: f }) => {
      await f.run(
        async () => {
          const todo = await f.seedTodo({
            title: "MCP original",
            content: "Retained MCP content",
            priority: "high",
            dueAt: new Date("2026-10-05T12:00:00+08:00"),
          });
          const client = await f.mcp();
          const response = await client.callTool({
            name: "workspace_todo_update",
            arguments: {
              id: todo.id,
              title: "MCP edited",
              completed: true,
              userId: f.other.id,
              mode: "full",
            },
          });
          expect(response.isError).not.toBe(true);
          expect(parseTextContent(response)).toMatchObject({
            success: true,
            todo: { id: todo.id, title: "MCP edited", completed: true },
          });
          expect(await f.stored(todo.id)).toEqual({
            ...todo,
            title: "MCP edited",
            completed: true,
            updatedAt: expect.any(Date),
          });
          await f.unchanged([todo.id]);
        },
        { calendarRebuilds: 1 },
      );
    });
    test("owner delete removes an independently prepared todo", {
      tag: "@Todo/MCP",
    }, async ({ ownership: f }) => {
      await f.run(
        async () => {
          const todo = await f.seedTodo({
            title: "MCP removable",
            content: "Private deletion target",
          });
          const client = await f.mcp();
          const response = await client.callTool({
            name: "workspace_todo_delete",
            arguments: { id: todo.id },
          });
          expect(response.isError).not.toBe(true);
          expect(parseTextContent(response)).toEqual({ success: true });
          expect(await f.stored(todo.id)).toBeNull();
          await f.unchanged();
        },
        { calendarRebuilds: 1 },
      );
    });
  });
