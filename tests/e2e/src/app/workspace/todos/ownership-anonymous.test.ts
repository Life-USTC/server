import {
  createQuery,
  deleteQuery,
  expect,
  listQuery,
  test,
  updateQuery,
} from "./_ownership";

test("todo ownership anonymous Web denies reads and writes", {
  tag: "@Todo/Web",
}, async ({ ownership: f }) => {
  await f.run(
    async () => {
      const request = await f.anonymous();
      const response = await request.get("/workspace/todos", {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(303);
      expect(response.headers().location).toContain("/account/sign-in?");
      for (const action of ["createTodo", "updateTodo"]) {
        const result = await request.post(`/workspace/todos?/${action}`, {
          headers: {
            origin: f.origin,
            accept: "application/json",
            "x-sveltekit-action": "true",
          },
          form: {
            id: f.other.todo.id,
            title: "Anonymous Web write",
            priority: "medium",
          },
        });
        expect(result.status()).toBe(200);
        expect(await result.json()).toMatchObject({
          type: "failure",
          status: 401,
        });
        await f.unchanged();
      }
    },
    { calendarRebuilds: 0 },
  );
});
test("todo ownership anonymous REST denies reads and writes", {
  tag: "@Todo/REST",
}, async ({ ownership: f }) => {
  await f.run(
    async () => {
      const request = await f.anonymous();
      expect((await request.get("/api/workspace/todos")).status()).toBe(401);
      for (const method of ["post", "patch", "delete"] as const) {
        const url =
          method === "post"
            ? "/api/workspace/todos"
            : `/api/workspace/todos/${f.other.todo.id}`;
        expect(
          (
            await request[method](url, { data: { title: "Anonymous write" } })
          ).status(),
        ).toBe(401);
        await f.unchanged();
      }
    },
    { calendarRebuilds: 0 },
  );
});
test("todo ownership anonymous GraphQL denies reads and writes", {
  tag: "@Todo/GraphQL",
}, async ({ ownership: f }) => {
  await f.run(
    async () => {
      const request = await f.anonymous();
      expect((await f.graphql(request, listQuery)).data.workspace).toBeNull();
      for (const [query, variables] of [
        [createQuery, { input: { title: "Anonymous write" } }],
        [
          updateQuery,
          { id: f.other.todo.id, input: { title: "Anonymous write" } },
        ],
        [deleteQuery, { id: f.other.todo.id }],
      ] as const) {
        expect(
          (await f.graphql(request, query, variables)).errors,
        ).toHaveLength(1);
        await f.unchanged();
      }
    },
    { calendarRebuilds: 0 },
  );
});
test("todo ownership anonymous MCP denies reads and writes", {
  tag: "@Todo/MCP",
}, async ({ ownership: f }) => {
  await f.run(
    async () => {
      const request = await f.anonymous();
      for (const [name, args] of [
        ["workspace_todo_list", {}],
        ["workspace_todo_create", { title: "Anonymous write" }],
        [
          "workspace_todo_update",
          { id: f.other.todo.id, title: "Anonymous write" },
        ],
        ["workspace_todo_delete", { id: f.other.todo.id }],
      ] as const) {
        const response = await request.post("/api/mcp", {
          headers: { accept: "application/json, text/event-stream" },
          data: {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name, arguments: args },
          },
        });
        expect(response.status()).toBe(401);
        expect(await response.text()).not.toContain(f.other.todo.content);
        await f.unchanged();
      }
    },
    { calendarRebuilds: 0 },
  );
});
