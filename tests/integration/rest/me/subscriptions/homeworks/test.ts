import { expect } from "@playwright/test";
import { test } from "../../../homeworks/_fixture";

const base = "/api/workspace/homeworks";

test(
  "anonymous subscribed homework read returns JSON 401",
  { tag: "@Homework/REST" },
  async ({ request, run }) =>
    run(async () => {
      const response = await request.get(base);
      expect(response.status()).toBe(401);
      expect(response.headers()["content-type"]).toContain("application/json");
      expect((await response.json()).error).toEqual(expect.any(String));
    }),
);

test(
  "known subscriptions project ordered homework fields and only the viewer's completion",
  { tag: "@Homework/REST" },
  async ({ homeworkState, run }) =>
    run(async () => {
      const { db, owner, other, section, homework } = homeworkState;
      const sectionState = await db.section.findUniqueOrThrow({
        where: { id: section.id },
        select: { code: true, course: { select: { nameCn: true } } },
      });
      await db.userSectionSubscription.create({
        data: { userId: owner.id, sectionId: section.id },
      });
      const earlier = await db.homework.create({
        data: {
          title: "earlier homework",
          sectionId: section.id,
          createdById: owner.id,
          submissionDueAt: new Date("2099-01-01T00:00:00Z"),
        },
      });
      await db.homework.create({
        data: {
          title: "deleted homework",
          sectionId: section.id,
          createdById: owner.id,
          deletedAt: new Date(),
        },
      });
      await db.homeworkCompletion.createMany({
        data: [
          {
            userId: other.id,
            homeworkId: homework.id,
            completedAt: new Date("2026-09-13T08:00:00Z"),
          },
          {
            userId: owner.id,
            homeworkId: earlier.id,
            completedAt: new Date("2026-09-14T08:00:00Z"),
          },
        ],
      });
      const response = await owner.request.get(base);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.pagination).toMatchObject({
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1,
      });
      expect(body.data.map((item: { id: string }) => item.id)).toEqual([
        earlier.id,
        homework.id,
      ]);
      expect(body.data[0].completion).toMatchObject({
        completedAt: "2026-09-14T16:00:00+08:00",
      });
      expect(body.data[1]).toMatchObject({
        id: homework.id,
        title: homework.title,
        sectionId: section.id,
        section: {
          code: sectionState.code,
          course: { nameCn: sectionState.course.nameCn },
        },
        completion: null,
      });
      const otherResponse = await other.request.get(base);
      expect(otherResponse.status()).toBe(200);
      expect(await otherResponse.json()).toMatchObject({
        data: [],
        pagination: { total: 0 },
      });
    }),
);

test(
  "known subscriptions paginate without losing or duplicating homework",
  { tag: "@Homework/REST" },
  async ({ homeworkState, run }) =>
    run(async () => {
      const { db, owner, section, homework } = homeworkState;
      await db.userSectionSubscription.create({
        data: { userId: owner.id, sectionId: section.id },
      });
      const earlier = await db.homework.create({
        data: {
          title: "first page homework",
          sectionId: section.id,
          submissionDueAt: new Date("2099-01-01T00:00:00Z"),
        },
      });
      for (const [page, id] of [
        [1, earlier.id],
        [2, homework.id],
      ] as const) {
        const response = await owner.request.get(
          `${base}?page=${page}&pageSize=1`,
        );
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.pagination).toMatchObject({
          page,
          pageSize: 1,
          total: 2,
          totalPages: 2,
        });
        expect(body.data.map((item: { id: string }) => item.id)).toEqual([id]);
      }
    }),
);

for (const query of ["page=101", "pageSize=51"]) {
  test(
    `subscribed homework rejects ${query}`,
    { tag: "@Homework/REST" },
    async ({ createActor, run }) =>
      run(async () => {
        const owner = await createActor();
        const response = await owner.request.get(`${base}?${query}`);
        expect(response.status()).toBe(400);
        expect((await response.json()).error).toEqual(expect.any(String));
      }),
  );
}
