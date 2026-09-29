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
        "owner CRUD persists authenticated ownership",
        async ({ ownership: f }) => {
          await f.run(
            async () => {
              const request = await f.request(mode, "graphql");
              const created = await f.graphql(request, createQuery, {
                input: { title: "GraphQL owned" },
              });
              expect(created.errors).toBeUndefined();
              const id = created.data.todoCreate.id;
              expect(await f.stored(id)).toMatchObject({
                userId: f.actor.id,
                title: "GraphQL owned",
                completed: false,
              });
              const updated = await f.graphql(request, updateQuery, {
                id,
                input: { title: "GraphQL edited", completed: true },
              });
              expect(updated.errors).toBeUndefined();
              expect(await f.stored(id)).toMatchObject({
                userId: f.actor.id,
                title: "GraphQL edited",
                completed: true,
              });
              const deleted = await f.graphql(request, deleteQuery, { id });
              expect(deleted.errors).toBeUndefined();
              expect(deleted.data.todoDelete).toMatchObject({
                id,
                success: true,
              });
              expect(await f.stored(id)).toBeNull();
              await f.unchanged();
            },
            { calendarRebuilds: 3 },
          );
        },
      );
      modeTest(
        "mixed-owner batch completion changes only owned row",
        async ({ ownership: f }) => {
          await f.run(
            async () => {
              const id = await f.seedCompleted();
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
              expect(await f.stored(id)).toMatchObject({
                userId: f.actor.id,
                title: "Batch owned",
                completed: false,
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
              const id = await f.seedCompleted();
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
