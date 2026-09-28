import { parseTextContent } from "../../api/mcp/helpers";
import { expect, roles, stored, test } from "./_ownership";

for (const role of roles)
  test.describe(`todo ownership OAuth MCP ${role}`, () => {
    test.use({ ownerRole: role });
    test("consumer returns only owned rows", async ({ ownership: f }) => {
      const client = await f.mcp();
      const result = parseTextContent(
        await client.callTool({
          name: "workspace_todo_list",
          arguments: { mode: "full", includeCompleted: true },
        }),
      ) as { todos: { id: string }[] };
      expect(result.todos.map((todo) => todo.id)).toEqual([f.actor.todo.id]);
      await f.unchanged();
    });
    test("foreign update and delete are rejected without effects", async ({
      ownership: f,
    }) => {
      const client = await f.mcp();
      for (const name of ["workspace_todo_update", "workspace_todo_delete"]) {
        const result = parseTextContent(
          await client.callTool({
            name,
            arguments: { id: f.other.todo.id, title: "MCP foreign overwrite" },
          }),
        );
        expect(result).toMatchObject({
          success: false,
          message: "Todo not found",
        });
        await f.unchanged();
      }
    });
    test("owner CRUD ignores forged creation owner", async ({
      ownership: f,
    }) => {
      const client = await f.mcp();
      const created = parseTextContent(
        await client.callTool({
          name: "workspace_todo_create",
          arguments: { title: "MCP owned", userId: f.other.id },
        }),
      ) as { id: string; success: boolean };
      expect(created.success).toBe(true);
      expect(await stored(created.id)).toMatchObject({
        userId: f.actor.id,
        title: "MCP owned",
        completed: false,
      });
      expect(
        parseTextContent(
          await client.callTool({
            name: "workspace_todo_update",
            arguments: { id: created.id, title: "MCP edited", completed: true },
          }),
        ).success,
      ).toBe(true);
      expect(await stored(created.id)).toMatchObject({
        userId: f.actor.id,
        title: "MCP edited",
        completed: true,
      });
      expect(
        parseTextContent(
          await client.callTool({
            name: "workspace_todo_delete",
            arguments: { id: created.id },
          }),
        ).success,
      ).toBe(true);
      expect(await stored(created.id)).toBeNull();
      await f.unchanged();
    });
  });
