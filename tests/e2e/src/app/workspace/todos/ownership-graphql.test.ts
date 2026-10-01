import {
  browserTest,
  createQuery,
  deleteQuery,
  expect,
  listQuery,
  roles,
  test,
  updateQuery,
} from "./_ownership";

for (const role of roles)
  for (const mode of ["cookie", "oauth"] as const) {
    const modeTest = mode === "oauth" ? browserTest : test;
    modeTest.describe(`todo ownership GraphQL ${mode} ${role}`, () => {
      modeTest.use({ ownerRole: role });
      modeTest("consumer returns only owned rows", async ({ ownership: f }) => {
        await f.run(
          async () => {
            const request = await f.request(mode, "graphql");
            const result = await f.graphql(request, listQuery);
            expect(result.errors).toBeUndefined();
            expect(
              result.data.workspace.todos.items.map(
                (todo: { id: string }) => todo.id,
              ),
            ).toEqual([f.actor.todo.id]);
            await f.unchanged();
          },
          { calendarRebuilds: 0 },
        );
      });
      modeTest(
        "foreign update and delete are rejected without effects",
        async ({ ownership: f }) => {
          await f.run(
            async () => {
              const request = await f.request(mode, "graphql");
              for (const query of [updateQuery, deleteQuery]) {
                const result = await f.graphql(request, query, {
                  id: f.other.todo.id,
                  input: { title: "foreign overwrite", completed: true },
                });
                expect(result.errors[0].extensions.code).toBe("NOT_FOUND");
                await f.unchanged();
              }
            },
            { calendarRebuilds: 0 },
          );
        },
      );
      modeTest(
        "owner create persists authenticated ownership",
        async ({ ownership: f }) => {
          await f.run(
            async () => {
              const request = await f.request(mode, "graphql");
              const response = await request.post("/api/graphql", {
                headers: { origin: f.origin },
                data: {
                  query: createQuery,
                  variables: { input: { title: "GraphQL owned" } },
                },
              });
              expect(response.status()).toBe(200);
              const created = await response.json();
              expect(created.errors).toBeUndefined();
              expect(created.data.todoCreate).toEqual({
                id: expect.any(String),
              });
              const { id } = created.data.todoCreate;
              expect(await f.stored(id)).toEqual({
                id,
                userId: f.actor.id,
                title: "GraphQL owned",
                content: null,
                completed: false,
                priority: "medium",
                dueAt: null,
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
              });
              await f.unchanged([id]);
            },
            { calendarRebuilds: 1 },
          );
        },
      );
      modeTest(
        "owner update preserves authenticated ownership",
        async ({ ownership: f }) => {
          await f.run(
            async () => {
              const todo = await f.seedTodo({
                title: "GraphQL original",
                content: "Retained GraphQL content",
                priority: "high",
                dueAt: new Date("2026-10-05T12:00:00+08:00"),
              });
              const request = await f.request(mode, "graphql");
              const response = await request.post("/api/graphql", {
                headers: { origin: f.origin },
                data: {
                  query: updateQuery,
                  variables: {
                    id: todo.id,
                    input: { title: "GraphQL edited", completed: true },
                  },
                },
              });
              expect(response.status()).toBe(200);
              const updated = await response.json();
              expect(updated.errors).toBeUndefined();
              expect(updated.data.todoUpdate).toEqual({ id: todo.id });
              expect(await f.stored(todo.id)).toEqual({
                ...todo,
                title: "GraphQL edited",
                completed: true,
                updatedAt: expect.any(Date),
              });
              await f.unchanged([todo.id]);
            },
            { calendarRebuilds: 1 },
          );
        },
      );
      modeTest(
        "owner delete removes an independently prepared todo",
        async ({ ownership: f }) => {
          await f.run(
            async () => {
              const todo = await f.seedTodo({
                title: "GraphQL removable",
                content: "Private deletion target",
              });
              const request = await f.request(mode, "graphql");
              const response = await request.post("/api/graphql", {
                headers: { origin: f.origin },
                data: { query: deleteQuery, variables: { id: todo.id } },
              });
              expect(response.status()).toBe(200);
              const deleted = await response.json();
              expect(deleted.errors).toBeUndefined();
              expect(deleted.data.todoDelete).toEqual({
                id: todo.id,
                success: true,
              });
              expect(await f.stored(todo.id)).toBeNull();
              await f.unchanged();
            },
            { calendarRebuilds: 1 },
          );
        },
      );
      modeTest(
        "mixed-owner batch completion changes only owned row",
        async ({ ownership: f }) => {
          await f.run(
            async () => {
              const todo = await f.seedTodo({
                title: "Batch owned",
                completed: true,
              });
              const id = todo.id;
              const request = await f.request(mode, "graphql");
              const result = await f.graphql(
                request,
                "mutation($items: [TodoCompletionBatchItemInput!]!) { todoCompletionsSet(items: $items) { results { todoId success error { code } } } }",
                {
                  items: [
                    { todoId: id, completed: false },
                    { todoId: f.other.todo.id, completed: true },
                  ],
                },
              );
              expect(result.errors).toBeUndefined();
              expect(result.data.todoCompletionsSet.results).toMatchObject([
                { todoId: id, success: true },
                {
                  todoId: f.other.todo.id,
                  success: false,
                  error: { code: "NOT_FOUND" },
                },
              ]);
              expect(await f.stored(id)).toEqual({
                ...todo,
                completed: false,
                updatedAt: expect.any(Date),
              });
              await f.unchanged([id]);
            },
            { calendarRebuilds: 1 },
          );
        },
      );
      modeTest(
        "mixed-owner batch deletion removes only owned row",
        async ({ ownership: f }) => {
          await f.run(
            async () => {
              const { id } = await f.seedTodo({
                title: "Batch owned",
                completed: true,
              });
              const request = await f.request(mode, "graphql");
              const result = await f.graphql(
                request,
                "mutation($ids: [ID!]!) { todosDelete(ids: $ids) { results { id success error { code } } } }",
                { ids: [id, f.other.todo.id] },
              );
              expect(result.errors).toBeUndefined();
              expect(result.data.todosDelete.results).toMatchObject([
                { id, success: true },
                {
                  id: f.other.todo.id,
                  success: false,
                  error: { code: "NOT_FOUND" },
                },
              ]);
              expect(await f.stored(id)).toBeNull();
              await f.unchanged();
            },
            { calendarRebuilds: 1 },
          );
        },
      );
    });
  }
