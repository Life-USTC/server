import { expect } from "@playwright/test";
import { test } from "../_fixture";

test.describe.configure({ mode: "parallel" });

for (const method of ["PATCH", "DELETE"] as const) {
  test.describe(`todo REST ${method} ownership`, () => {
    for (const scenario of [
      { name: "anonymous", isAdmin: false, owns: false, status: 401 },
      { name: "user owner", isAdmin: false, owns: true, status: 200 },
      { name: "other user", isAdmin: false, owns: false, status: 404 },
      { name: "admin owner", isAdmin: true, owns: true, status: 200 },
      { name: "other admin", isAdmin: true, owns: false, status: 404 },
    ]) {
      test(
        scenario.name,
        async ({ createActor, request: anonymous, db, run }) => {
          await run(async () => {
            const actor = await createActor({ isAdmin: scenario.isAdmin });
            const owner = scenario.owns ? actor : await createActor();
            const caller =
              scenario.name === "anonymous" ? anonymous : actor.request;
            const sessionResponse = await caller.get("/api/auth/get-session");
            expect(sessionResponse.status()).toBe(200);
            const session = await sessionResponse.json();
            if (scenario.name === "anonymous")
              expect(session?.user).toBeUndefined();
            else
              expect(session.user).toMatchObject({
                id: actor.id,
                isAdmin: scenario.isAdmin,
              });
            expect(
              await db.userSuspension.count({ where: { userId: actor.id } }),
            ).toBe(0);
            const before = await db.todo.create({
              data: {
                userId: owner.id,
                title: "Owned todo",
                priority: "medium",
              },
            });
            const response = await caller.fetch(
              `/api/workspace/todos/${before.id}`,
              {
                method,
                ...(method === "PATCH" ? { data: { completed: true } } : {}),
              },
            );
            expect(response.status()).toBe(scenario.status);
            expect(response.headers()["content-type"]).toContain(
              "application/json",
            );
            const body = await response.json();
            const after = await db.todo.findUnique({
              where: { id: before.id },
            });
            if (scenario.status !== 200) {
              expect(typeof body.error).toBe("string");
              expect(after).toEqual(before);
            } else if (method === "PATCH") {
              expect(body).toMatchObject({
                success: true,
                todo: { id: before.id, completed: true },
              });
              expect(after).toMatchObject({
                ...before,
                completed: true,
                updatedAt: expect.any(Date),
              });
            } else {
              expect(body).toEqual({ success: true });
              expect(after).toBeNull();
            }
          });
        },
      );
    }

    test("missing target returns 404", async ({ createActor, run }) => {
      await run(async () => {
        const { request } = await createActor();
        const response = await request.fetch(
          `/api/workspace/todos/${crypto.randomUUID()}`,
          {
            method,
            ...(method === "PATCH" ? { data: { completed: true } } : {}),
          },
        );
        expect(response.status()).toBe(404);
        expect(typeof (await response.json()).error).toBe("string");
      });
    });

    test("anonymous malformed input still returns a JSON 401", async ({
      request,
      run,
    }) => {
      await run(async () => {
        const response = await request.fetch(
          "/api/workspace/todos/invalid-e2e",
          {
            method,
            ...(method === "PATCH" ? { data: {} } : {}),
          },
        );
        expect(response.status()).toBe(401);
        expect(response.headers()["content-type"]).toContain(
          "application/json",
        );
        expect(typeof (await response.json()).error).toBe("string");
      });
    });
  });
}

test("todo PATCH returns its public fields and persists the edited values", async ({
  createActor,
  db,
  run,
}) => {
  await run(async () => {
    const actor = await createActor();
    const before = await db.todo.create({
      data: { userId: actor.id, title: "Original title", priority: "medium" },
    });
    const response = await actor.request.patch(
      `/api/workspace/todos/${before.id}`,
      { data: { title: "Updated todo title", completed: true } },
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      todo: {
        id: before.id,
        title: "Updated todo title",
        completed: true,
        content: null,
        dueAt: null,
        priority: "medium",
      },
    });
    for (const field of ["createdAt", "updatedAt"]) {
      expect(typeof body.todo[field]).toBe("string");
      expect(Number.isNaN(Date.parse(body.todo[field]))).toBe(false);
    }
    expect(
      await db.todo.findUnique({ where: { id: before.id } }),
    ).toMatchObject({
      ...before,
      title: "Updated todo title",
      completed: true,
      updatedAt: new Date(body.todo.updatedAt),
    });
  });
});

test("deleting a todo removes it from the owner's subsequent list", async ({
  createActor,
  db,
  run,
}) => {
  await run(async () => {
    const { id: userId, request } = await createActor();
    const { id } = await db.todo.create({
      data: {
        userId,
        title: "Independently prepared deletion",
        priority: "medium",
      },
    });
    const deleted = await request.delete(`/api/workspace/todos/${id}`);
    expect(deleted.status()).toBe(200);
    expect(await deleted.json()).toEqual({ success: true });
    const listed = await request.get("/api/workspace/todos");
    expect(listed.status()).toBe(200);
    expect((await listed.json()).todos).toEqual([]);
    expect(await db.todo.findUnique({ where: { id } })).toBeNull();
  });
});
