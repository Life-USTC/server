import { browserTest, expect, roles, test } from "./_ownership";

for (const role of roles)
  for (const mode of ["cookie", "oauth"] as const) {
    const modeTest = mode === "oauth" ? browserTest : test;
    modeTest.describe(`todo ownership REST ${mode} ${role}`, () => {
      modeTest.use({ ownerRole: role });
      modeTest(
        "consumer ignores forged owner filters",
        { tag: "@Todo/REST" },
        async ({ ownership: f }) => {
          await f.run(
            async () => {
              const request = await f.request(mode, "rest");
              const response = await request.get(
                `/api/workspace/todos?userId=${f.other.id}`,
              );
              expect(response.status()).toBe(200);
              const body = await response.json();
              expect(body.todos.map((todo: { id: string }) => todo.id)).toEqual(
                [f.actor.todo.id],
              );
              expect(body.counts).toMatchObject({
                incomplete: 1,
                completed: 0,
              });
              await f.unchanged();
            },
            { calendarRebuilds: 0 },
          );
        },
      );
      modeTest(
        "foreign update and delete are rejected without effects",
        { tag: "@Todo/REST" },
        async ({ ownership: f }) => {
          await f.run(
            async () => {
              const request = await f.request(mode, "rest");
              for (const method of ["patch", "delete"] as const) {
                const response = await request[method](
                  `/api/workspace/todos/${f.other.todo.id}`,
                  { data: { title: "foreign overwrite", completed: true } },
                );
                expect(response.status()).toBe(404);
                await f.unchanged();
              }
            },
            { calendarRebuilds: 0 },
          );
        },
      );
      modeTest(
        "owner create ignores forged ownership",
        { tag: "@Todo/REST" },
        async ({ ownership: f }) => {
          await f.run(
            async () => {
              const request = await f.request(mode, "rest");
              const created = await request.post("/api/workspace/todos", {
                data: { title: "REST owned", userId: f.other.id },
              });
              expect(created.status()).toBe(201);
              const body = await created.json();
              expect(body).toEqual({ id: expect.any(String) });
              expect(created.headers().location).toBe(
                `/api/workspace/todos/${body.id}`,
              );
              expect(await f.stored(body.id)).toEqual({
                id: body.id,
                userId: f.actor.id,
                title: "REST owned",
                content: null,
                completed: false,
                priority: "medium",
                dueAt: null,
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
              });
              await f.unchanged([body.id]);
            },
            { calendarRebuilds: 1 },
          );
        },
      );
      modeTest(
        "owner update preserves authenticated ownership",
        { tag: "@Todo/REST" },
        async ({ ownership: f }) => {
          await f.run(
            async () => {
              const todo = await f.seedTodo({
                title: "REST original",
                content: "Retained REST content",
                priority: "high",
                dueAt: new Date("2026-10-05T12:00:00+08:00"),
              });
              const request = await f.request(mode, "rest");
              const updated = await request.patch(
                `/api/workspace/todos/${todo.id}`,
                {
                  data: {
                    title: "REST edited",
                    completed: true,
                    userId: f.other.id,
                  },
                },
              );
              expect(updated.status()).toBe(200);
              expect(await updated.json()).toMatchObject({
                success: true,
                todo: { id: todo.id, title: "REST edited", completed: true },
              });
              expect(await f.stored(todo.id)).toEqual({
                ...todo,
                title: "REST edited",
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
        { tag: "@Todo/REST" },
        async ({ ownership: f }) => {
          await f.run(
            async () => {
              const todo = await f.seedTodo({
                title: "REST removable",
                content: "Private deletion target",
              });
              const request = await f.request(mode, "rest");
              const deleted = await request.delete(
                `/api/workspace/todos/${todo.id}`,
              );
              expect(deleted.status()).toBe(200);
              expect(await deleted.json()).toEqual({ success: true });
              expect(await f.stored(todo.id)).toBeNull();
              await f.unchanged();
            },
            { calendarRebuilds: 1 },
          );
        },
      );
      modeTest(
        "mixed-owner batch completion changes only owned row",
        { tag: "@Todo/REST" },
        async ({ ownership: f }) => {
          await f.run(
            async () => {
              const todo = await f.seedTodo({
                title: "Batch owned",
                completed: true,
              });
              const id = todo.id;
              const request = await f.request(mode, "rest");
              const response = await request.patch(
                "/api/workspace/todos/batch",
                {
                  data: {
                    items: [
                      { todoId: id, completed: false },
                      { todoId: f.other.todo.id, completed: true },
                    ],
                  },
                },
              );
              expect(response.status()).toBe(200);
              expect((await response.json()).results).toMatchObject([
                { todoId: id, success: true },
                {
                  todoId: f.other.todo.id,
                  success: false,
                  error: { code: "not_found" },
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
        { tag: "@Todo/REST" },
        async ({ ownership: f }) => {
          await f.run(
            async () => {
              const { id } = await f.seedTodo({
                title: "Batch owned",
                completed: true,
              });
              const request = await f.request(mode, "rest");
              const response = await request.delete(
                "/api/workspace/todos/batch",
                {
                  data: { ids: [id, f.other.todo.id] },
                },
              );
              expect(response.status()).toBe(200);
              expect((await response.json()).results).toMatchObject([
                { id, success: true },
                {
                  id: f.other.todo.id,
                  success: false,
                  error: { code: "not_found" },
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
