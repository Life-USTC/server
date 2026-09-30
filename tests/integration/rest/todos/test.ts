import { expect } from "@playwright/test";
import { test } from "./_fixture";

const base = "/api/workspace/todos";

for (const method of ["get", "post"] as const) {
  test(`anonymous ${method} returns JSON 401`, async ({ request, run }) => {
    await run(async () => {
      const response = await request[method](
        base,
        method === "post" ? { data: { title: "denied" } } : {},
      );
      expect(response.status()).toBe(401);
      expect(response.headers()["content-type"]).toContain("application/json");
      expect((await response.json()).error).toEqual(expect.any(String));
    });
  });
}

test("known todos expose complete fields, counts and only the current owner", async ({
  createActor,
  db,
  run,
}) => {
  await run(async () => {
    const owner = await createActor();
    const other = await createActor();
    const overdue = await db.todo.create({
      data: {
        userId: owner.id,
        title: "overdue",
        content: "known content",
        priority: "high",
        dueAt: new Date("2000-01-01T00:00:00Z"),
      },
    });
    await db.todo.createMany({
      data: [
        {
          userId: owner.id,
          title: "future",
          dueAt: new Date("2100-01-01T00:00:00Z"),
        },
        { userId: owner.id, title: "done", completed: true },
        { userId: other.id, title: "private" },
      ],
    });
    const response = await owner.request.get(base);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.counts).toEqual({ incomplete: 2, completed: 1, overdue: 1 });
    expect(
      body.todos.map((todo: { title: string }) => todo.title).sort(),
    ).toEqual(["done", "future", "overdue"]);
    expect(
      body.todos.find((todo: { id: string }) => todo.id === overdue.id),
    ).toMatchObject({
      id: overdue.id,
      title: "overdue",
      content: "known content",
      priority: "high",
      completed: false,
      dueAt: "2000-01-01T08:00:00+08:00",
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });
});

test("completed and limit filters consume independently prepared rows", async ({
  createActor,
  db,
  run,
}) => {
  await run(async () => {
    const owner = await createActor();
    await db.todo.createMany({
      data: [
        { userId: owner.id, title: "incomplete A" },
        { userId: owner.id, title: "incomplete B" },
        { userId: owner.id, title: "completed", completed: true },
      ],
    });
    const response = await owner.request.get(`${base}?completed=false&limit=1`);
    expect(response.status()).toBe(200);
    expect((await response.json()).todos).toEqual([
      expect.objectContaining({ completed: false }),
    ]);
  });
});

test("bare dueBefore uses its UTC date boundary", async ({
  createActor,
  db,
  run,
}) => {
  await run(async () => {
    const owner = await createActor();
    const before = await db.todo.create({
      data: {
        userId: owner.id,
        title: "before",
        dueAt: new Date("2026-09-27T23:59:59Z"),
      },
    });
    await db.todo.create({
      data: {
        userId: owner.id,
        title: "at boundary",
        dueAt: new Date("2026-09-28T00:00:00Z"),
      },
    });
    const response = await owner.request.get(
      `${base}?completed=false&dueBefore=2026-09-28`,
    );
    expect(response.status()).toBe(200);
    expect(
      (await response.json()).todos.map((todo: { id: string }) => todo.id),
    ).toEqual([before.id]);
  });
});

for (const query of ["dueBefore=not-a-date", "limit=0"]) {
  test(`rejects invalid query ${query}`, async ({ createActor, run }) => {
    await run(async () => {
      const owner = await createActor();
      const response = await owner.request.get(`${base}?${query}`);
      expect(response.status()).toBe(400);
      expect((await response.json()).error).toEqual(expect.any(String));
    });
  });
}

test("openapi.todo-created-status", async ({ createActor, db, run }) => {
  await run(async () => {
    const owner = await createActor();
    const other = await createActor();
    const content = "x".repeat(4_000);
    const response = await owner.request.post(base, {
      data: {
        title: "created todo",
        content: ` ${content} `,
        priority: "high",
      },
    });
    expect(response.status()).toBe(201);
    const { id } = await response.json();
    expect(id).toEqual(expect.any(String));
    expect(response.headers().location).toBe(`${base}/${id}`);
    expect(await db.todo.findUniqueOrThrow({ where: { id } })).toMatchObject({
      userId: owner.id,
      title: "created todo",
      content,
      priority: "high",
      completed: false,
    });
    expect(await db.todo.count({ where: { userId: other.id } })).toBe(0);
    const read = await owner.request.get(base);
    expect(read.status()).toBe(200);
    expect((await read.json()).todos).toEqual([
      expect.objectContaining({
        id,
        title: "created todo",
        content,
        priority: "high",
      }),
    ]);
  });
});
