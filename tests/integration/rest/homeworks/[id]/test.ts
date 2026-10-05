import { expect } from "@playwright/test";
import { base, test } from "../_fixture";

for (const method of ["patch", "delete"] as const) {
  test(
    `anonymous ${method} is rejected without changing homework`,
    { tag: "@Homework/REST" },
    async ({ request, homeworkState, run }) =>
      run(async () => {
        const { db, homework } = homeworkState;
        const before = await db.homework.findUniqueOrThrow({
          where: { id: homework.id },
        });
        const response = await request[method](`${base}/${homework.id}`, {
          data: { title: "denied" },
        });
        expect(response.status()).toBe(401);
        expect((await response.json()).error).toEqual(expect.any(String));
        expect(
          await db.homework.findUniqueOrThrow({ where: { id: homework.id } }),
        ).toEqual(before);
      }),
  );
}

for (const titleChanged of [true, false]) {
  test(
    `PATCH ${titleChanged ? "title and description" : "description only"} persists the intended fields`,
    { tag: "@Homework/REST" },
    async ({ homeworkState, run }) =>
      run(async () => {
        const { db, other, homework } = homeworkState;
        const title = titleChanged ? "updated title" : homework.title;
        // Homework descriptions and titles are collaboratively editable by active users.
        const response = await other.request.patch(`${base}/${homework.id}`, {
          data: {
            ...(titleChanged ? { title } : {}),
            description: "updated description",
          },
        });
        expect(response.status()).toBe(200);
        expect(await response.json()).toMatchObject({
          success: true,
          homework: {
            id: homework.id,
            title,
            description: { content: "updated description" },
          },
        });
        expect(
          await db.homework.findUniqueOrThrow({
            where: { id: homework.id },
            include: { description: true },
          }),
        ).toMatchObject({
          title,
          description: {
            content: "updated description",
            lastEditedById: other.id,
          },
        });
        expect(
          await db.auditLog.findMany({
            where: { targetId: homework.id, action: "homework_update" },
          }),
        ).toEqual([expect.objectContaining({ userId: other.id })]);
        const detail = await other.request.get(`${base}/${homework.id}`);
        expect(detail.status()).toBe(200);
        expect((await detail.json()).homework).toMatchObject({
          id: homework.id,
          title,
          description: { content: "updated description" },
        });
      }),
  );
}

test(
  "empty PATCH returns No changes without writing data or audit",
  { tag: "@Homework/REST" },
  async ({ homeworkState, run }) =>
    run(async () => {
      const { db, owner, homework } = homeworkState;
      const before = await db.homework.findUniqueOrThrow({
        where: { id: homework.id },
        include: { description: true },
      });
      const response = await owner.request.patch(`${base}/${homework.id}`, {
        data: {},
      });
      expect(response.status()).toBe(400);
      expect(await response.json()).toMatchObject({ error: "No changes" });
      expect(
        await db.homework.findUniqueOrThrow({
          where: { id: homework.id },
          include: { description: true },
        }),
      ).toEqual(before);
      expect(
        await db.auditLog.count({ where: { targetId: homework.id } }),
      ).toBe(0);
    }),
);

test(
  "creator DELETE is idempotent, audited once and hidden from the list",
  { tag: "@Homework/REST" },
  async ({ homeworkState, run }) =>
    run(async () => {
      const { db, owner, homework, section } = homeworkState;
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await owner.request.delete(`${base}/${homework.id}`);
        expect(response.status()).toBe(200);
        expect(await response.json()).toMatchObject({ success: true });
      }
      expect(
        await db.homework.findUniqueOrThrow({ where: { id: homework.id } }),
      ).toMatchObject({
        deletedAt: expect.any(Date),
        deletedById: owner.id,
      });
      expect(
        await db.auditLog.count({
          where: { targetId: homework.id, action: "homework_delete" },
        }),
      ).toBe(1);
      const response = await owner.request.get(
        `${base}?sectionId=${section.id}`,
      );
      expect(response.status()).toBe(200);
      expect((await response.json()).data).toEqual([]);
    }),
);

for (const isAdmin of [false, true]) {
  test(
    `non-creator ${isAdmin ? "admin" : "user"} cannot DELETE through the community endpoint`,
    { tag: "@Homework/REST" },
    async ({ createActor, homeworkState, run }) =>
      run(async () => {
        const { db, homework } = homeworkState;
        const actor = await createActor({ isAdmin });
        const before = await db.homework.findUniqueOrThrow({
          where: { id: homework.id },
        });
        const response = await actor.request.delete(`${base}/${homework.id}`);
        expect(response.status()).toBe(403);
        expect((await response.json()).error).toEqual(expect.any(String));
        expect(
          await db.homework.findUniqueOrThrow({ where: { id: homework.id } }),
        ).toEqual(before);
      }),
  );
}

for (const method of ["get", "patch", "delete"] as const) {
  test(
    `unknown homework ${method} returns JSON 404`,
    { tag: "@Homework/REST" },
    async ({ createActor, run }) =>
      run(async () => {
        const actor = await createActor();
        const response = await actor.request[method](
          `${base}/missing-${crypto.randomUUID()}`,
          {
            ...(method === "patch" ? { data: { title: "missing" } } : {}),
          },
        );
        expect(response.status()).toBe(404);
        expect(response.headers()["content-type"]).toContain(
          "application/json",
        );
        expect((await response.json()).error).toEqual(expect.any(String));
      }),
  );
}
