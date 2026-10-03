import { expect } from "@playwright/test";
import { base, test } from "../../_fixture";

const path = (id: string) => `/api/workspace/homeworks/${id}/completion`;
const completedAt = new Date("2026-09-13T08:00:00Z");

test("anonymous completion returns JSON 401 and preserves known completion", async ({
  request,
  homeworkState,
  run,
}) =>
  run(async () => {
    const { db, owner, homework } = homeworkState;
    await db.homeworkCompletion.create({
      data: { userId: owner.id, homeworkId: homework.id, completedAt },
    });
    for (const data of [{}, { completed: false }]) {
      const response = await request.put(path(homework.id), { data });
      expect(response.status()).toBe(401);
      expect(response.headers()["content-type"]).toContain("application/json");
      expect((await response.json()).error).toEqual(expect.any(String));
    }
    expect(
      await db.homeworkCompletion.findMany({
        where: { homeworkId: homework.id },
      }),
    ).toEqual([{ userId: owner.id, homeworkId: homework.id, completedAt }]);
  }));

for (const completed of [true, false]) {
  test(`completion ${completed} changes only its owner and is reflected in detail`, async ({
    homeworkState,
    run,
  }) =>
    run(async () => {
      const { db, owner, other, homework } = homeworkState;
      await db.homeworkCompletion.createMany({
        data: [
          { userId: other.id, homeworkId: homework.id, completedAt },
          ...(!completed
            ? [{ userId: owner.id, homeworkId: homework.id, completedAt }]
            : []),
        ],
      });
      const response = await owner.request.put(path(homework.id), {
        data: { completed },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        completed,
        completedAt: completed ? expect.any(String) : null,
      });
      expect(
        await db.homeworkCompletion.findUnique({
          where: {
            userId_homeworkId: { userId: owner.id, homeworkId: homework.id },
          },
        }),
      ).toEqual(
        completed
          ? {
              userId: owner.id,
              homeworkId: homework.id,
              completedAt: new Date(body.completedAt),
            }
          : null,
      );
      expect(
        await db.homeworkCompletion.findUniqueOrThrow({
          where: {
            userId_homeworkId: { userId: other.id, homeworkId: homework.id },
          },
        }),
      ).toEqual({ userId: other.id, homeworkId: homework.id, completedAt });
      const detail = await owner.request.get(`${base}/${homework.id}`);
      expect(detail.status()).toBe(200);
      expect((await detail.json()).homework.completion).toEqual(
        completed
          ? expect.objectContaining({ completedAt: body.completedAt })
          : null,
      );
    }));
}

test("missing homework completion returns 404", async ({ createActor, run }) =>
  run(async () => {
    const owner = await createActor();
    const response = await owner.request.put(
      path(`missing-${crypto.randomUUID()}`),
      { data: { completed: true } },
    );
    expect(response.status()).toBe(404);
    expect((await response.json()).error).toEqual(expect.any(String));
  }));
