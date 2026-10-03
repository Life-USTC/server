import { expect } from "@playwright/test";
import { test } from "../_fixture";

const path = "/api/workspace/homeworks/completions";
const completedAt = new Date("2026-09-13T08:00:00Z");

test("rejects anonymous completion writes before validating the body", async ({
  request,
  completionState,
  run,
}) =>
  run(async () => {
    const { db, owner, createHomeworks } = completionState;
    const [homeworkId] = await createHomeworks(1);
    await db.homeworkCompletion.create({
      data: { userId: owner.id, homeworkId, completedAt },
    });
    for (const data of [{}, { items: [{ homeworkId, completed: false }] }]) {
      const response = await request.put(path, { data });
      expect(response.status()).toBe(401);
      expect((await response.json()).error).toEqual(expect.any(String));
    }
    expect(
      await db.homeworkCompletion.findMany({
        where: { homeworkId },
        select: { userId: true, completedAt: true },
      }),
    ).toEqual([{ userId: owner.id, completedAt }]);
  }));

test("returns per-item results for known active, deleted and missing homework", async ({
  completionState,
  run,
}) =>
  run(async () => {
    const { db, owner, other, createHomeworks } = completionState;
    const [active, deleted] = await createHomeworks(2);
    await db.homework.update({
      where: { id: deleted },
      data: { deletedAt: completedAt, deletedById: owner.id },
    });
    await db.homeworkCompletion.create({
      data: { userId: other.id, homeworkId: active, completedAt },
    });
    const response = await owner.request.put(path, {
      data: {
        items: [
          { homeworkId: active, completed: true },
          { homeworkId: deleted, completed: true },
          { homeworkId: "missing-homework", completed: false },
        ],
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.results).toHaveLength(3);
    expect(body.results[0]).toMatchObject({
      success: true,
      homeworkId: active,
      completed: true,
      completedAt: expect.any(String),
    });
    expect(body.results[1]).toMatchObject({
      success: false,
      homeworkId: deleted,
      completed: true,
      error: { code: "deleted" },
    });
    expect(body.results[2]).toMatchObject({
      success: false,
      homeworkId: "missing-homework",
      completed: false,
      error: { code: "not_found" },
    });
    expect(
      await db.homeworkCompletion.findMany({
        where: { homeworkId: { in: [active, deleted] } },
        select: { userId: true, homeworkId: true, completedAt: true },
        orderBy: { userId: "asc" },
      }),
    ).toEqual(
      [
        { userId: owner.id, homeworkId: active, completedAt: expect.any(Date) },
        { userId: other.id, homeworkId: active, completedAt },
      ].sort((a, b) => a.userId.localeCompare(b.userId)),
    );
  }));

for (const size of [1, 100]) {
  test(`accepts ${size} completion writes and preserves another owner's state`, async ({
    completionState,
    run,
  }) =>
    run(async () => {
      const { db, owner, other, createHomeworks } = completionState;
      const ids = await createHomeworks(size);
      await db.homeworkCompletion.create({
        data: { userId: other.id, homeworkId: ids[0], completedAt },
      });
      const response = await owner.request.put(path, {
        data: {
          items: ids.map((homeworkId) => ({ homeworkId, completed: true })),
        },
      });
      expect(response.status()).toBe(200);
      expect((await response.json()).results).toEqual(
        ids.map((homeworkId) => ({
          success: true,
          homeworkId,
          completed: true,
          completedAt: expect.any(String),
        })),
      );
      expect(
        await db.homeworkCompletion.findMany({
          where: { userId: owner.id },
          select: { homeworkId: true, completedAt: true },
          orderBy: { homeworkId: "asc" },
        }),
      ).toEqual(
        [...ids]
          .sort()
          .map((homeworkId) => ({ homeworkId, completedAt: expect.any(Date) })),
      );
      expect(
        await db.homeworkCompletion.findMany({
          where: { userId: other.id },
          select: { homeworkId: true, completedAt: true },
        }),
      ).toEqual([{ homeworkId: ids[0], completedAt }]);
    }));
}

for (const scenario of [
  "empty",
  "over 100",
  "duplicate",
  "normalized duplicate",
] as const) {
  test(`rejects ${scenario} completion batch before changing state`, async ({
    completionState,
    run,
  }) =>
    run(async () => {
      const { db, owner, other, createHomeworks } = completionState;
      const [homeworkId] = await createHomeworks(1);
      await db.homeworkCompletion.createMany({
        data: [owner, other].map(({ id }) => ({
          userId: id,
          homeworkId,
          completedAt,
        })),
      });
      const before = await db.homeworkCompletion.findMany({
        where: { homeworkId },
        orderBy: { userId: "asc" },
      });
      const items =
        scenario === "empty"
          ? []
          : scenario === "over 100"
            ? Array.from({ length: 101 }, (_, index) => ({
                homeworkId: index === 0 ? homeworkId : `missing-${index}`,
                completed: false,
              }))
            : [
                { homeworkId, completed: false },
                {
                  homeworkId:
                    scenario === "normalized duplicate"
                      ? ` ${homeworkId} `
                      : homeworkId,
                  completed: true,
                },
              ];
      const response = await owner.request.put(path, { data: { items } });
      expect(response.status()).toBe(400);
      expect(
        await db.homeworkCompletion.findMany({
          where: { homeworkId },
          orderBy: { userId: "asc" },
        }),
      ).toEqual(before);
    }));
}
