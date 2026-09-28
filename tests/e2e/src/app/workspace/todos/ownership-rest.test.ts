import { expect, roles, stored, test } from "./_ownership";

for (const role of roles)
  for (const mode of ["cookie", "oauth"] as const) {
    test.describe(`todo ownership REST ${mode} ${role}`, () => {
      test.use({ ownerRole: role });
      test("consumer ignores forged owner filters", async ({
        ownership: f,
      }) => {
        const request = await f.request(mode, "rest");
        const response = await request.get(
          `/api/workspace/todos?userId=${f.other.id}`,
        );
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.todos.map((todo: { id: string }) => todo.id)).toEqual([
          f.actor.todo.id,
        ]);
        expect(body.counts).toMatchObject({ incomplete: 1, completed: 0 });
        await f.unchanged();
      });
      test("foreign update and delete are rejected without effects", async ({
        ownership: f,
      }) => {
        const request = await f.request(mode, "rest");
        for (const method of ["patch", "delete"] as const) {
          const response = await request[method](
            `/api/workspace/todos/${f.other.todo.id}`,
            { data: { title: "foreign overwrite", completed: true } },
          );
          expect(response.status()).toBe(404);
          await f.unchanged();
        }
      });
      test("owner CRUD ignores forged creation owner", async ({
        ownership: f,
      }) => {
        const request = await f.request(mode, "rest");
        const created = await request.post("/api/workspace/todos", {
          data: { title: "REST owned", userId: f.other.id },
        });
        expect(created.status()).toBe(201);
        const { id } = await created.json();
        expect(await stored(id)).toMatchObject({
          userId: f.actor.id,
          title: "REST owned",
          completed: false,
        });
        expect(
          (
            await request.patch(`/api/workspace/todos/${id}`, {
              data: { title: "REST edited", completed: true },
            })
          ).status(),
        ).toBe(200);
        expect(await stored(id)).toMatchObject({
          userId: f.actor.id,
          title: "REST edited",
          completed: true,
        });
        expect(
          (await request.delete(`/api/workspace/todos/${id}`)).status(),
        ).toBe(200);
        expect(await stored(id)).toBeNull();
        await f.unchanged();
      });
      test("mixed-owner batch completion changes only owned row", async ({
        ownership: f,
      }) => {
        const id = await f.seedCompleted();
        const request = await f.request(mode, "rest");
        const response = await request.patch("/api/workspace/todos/batch", {
          data: {
            items: [
              { todoId: id, completed: false },
              { todoId: f.other.todo.id, completed: true },
            ],
          },
        });
        expect(response.status()).toBe(200);
        expect((await response.json()).results).toMatchObject([
          { todoId: id, success: true },
          {
            todoId: f.other.todo.id,
            success: false,
            error: { code: "not_found" },
          },
        ]);
        expect(await stored(id)).toMatchObject({
          userId: f.actor.id,
          title: "Batch owned",
          completed: false,
        });
        await f.unchanged([id]);
      });
      test("mixed-owner batch deletion removes only owned row", async ({
        ownership: f,
      }) => {
        const id = await f.seedCompleted();
        const request = await f.request(mode, "rest");
        const response = await request.delete("/api/workspace/todos/batch", {
          data: { ids: [id, f.other.todo.id] },
        });
        expect(response.status()).toBe(200);
        expect((await response.json()).results).toMatchObject([
          { id, success: true },
          { id: f.other.todo.id, success: false, error: { code: "not_found" } },
        ]);
        expect(await stored(id)).toBeNull();
        await f.unchanged();
      });
    });
  }
