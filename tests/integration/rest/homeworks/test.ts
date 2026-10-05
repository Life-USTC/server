import { expect } from "@playwright/test";
import { base, test } from "./_fixture";

test(
  "known homework summary omits detail relations and personalizes only completion",
  { tag: "@Homework/REST" },
  async ({ homeworkState, request, run }) =>
    run(async () => {
      const { db, owner, other, section, homework } = homeworkState;
      const completedAt = new Date("2026-09-13T08:00:00Z");
      await db.homeworkCompletion.create({
        data: { userId: owner.id, homeworkId: homework.id, completedAt },
      });
      const response = await owner.request.get(
        `${base}?sectionId=${section.id}`,
      );
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("application/json");
      const body = await response.json();
      expect(body.meta.viewer.userId).toBe(owner.id);
      expect(body.pagination).toMatchObject({
        page: 1,
        pageSize: 20,
        total: 1,
      });
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        id: homework.id,
        title: homework.title,
        sectionId: section.id,
        commentCount: 0,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        publishedAt: expect.any(String),
        submissionStartAt: expect.any(String),
        submissionDueAt: expect.any(String),
        completion: { completedAt: "2026-09-13T16:00:00+08:00" },
      });
      for (const field of [
        "description",
        "section",
        "createdBy",
        "updatedBy",
      ]) {
        expect(body.data[0]).not.toHaveProperty(field);
      }
      for (const reader of [other.request, request]) {
        const read = await reader.get(`${base}?sectionJwId=${section.jwId}`);
        expect(read.status()).toBe(200);
        expect((await read.json()).data).toEqual([
          expect.objectContaining({
            id: homework.id,
            completion: null,
          }),
        ]);
      }
    }),
);

test(
  "known homework detail and explicit section audit load independently",
  { tag: "@Homework/REST" },
  async ({ homeworkState, run }) =>
    run(async () => {
      const { db, owner, section, homework } = homeworkState;
      await db.auditLog.create({
        data: {
          action: "homework_create",
          userId: owner.id,
          subjectUserId: owner.id,
          targetType: "homework",
          targetId: homework.id,
          metadata: { sectionId: section.id },
        },
      });
      const detail = await owner.request.get(`${base}/${homework.id}`);
      expect(detail.status()).toBe(200);
      const body = await detail.json();
      expect(body.homework).toMatchObject({
        id: homework.id,
        description: { content: "known description" },
        section: { id: section.id },
      });
      expect(body.auditLogs).toHaveLength(1);
      const audit = await owner.request.get(
        `${base}/audit?sectionId=${section.id}`,
      );
      expect(audit.status()).toBe(200);
      expect(audit.headers()["content-type"]).toContain("application/json");
      expect((await audit.json()).auditLogs).toEqual([
        expect.objectContaining({ homeworkId: homework.id }),
      ]);
    }),
);

for (const [query, status] of [
  ["sectionJwId=999999999", 404],
  ["", 400],
  [
    `sectionIds=${Array.from({ length: 51 }, (_, index) => index + 1).join(",")}`,
    400,
  ],
  ["sectionId=1&page=101", 400],
  ["sectionId=1&pageSize=51", 400],
] as const) {
  test(
    `list rejects ${query || "missing section"} with ${status}`,
    { tag: "@Homework/REST" },
    async ({ request, run }) =>
      run(async () => {
        const response = await request.get(`${base}?${query}`);
        expect(response.status()).toBe(status);
        expect((await response.json()).error).toEqual(expect.any(String));
      }),
  );
}

test(
  "audit requires a section and returns JSON",
  { tag: "@Homework/REST" },
  async ({ request, run }) =>
    run(async () => {
      const response = await request.get(`${base}/audit`);
      expect(response.status()).toBe(400);
      expect(response.headers()["content-type"]).toContain("application/json");
    }),
);

test(
  "anonymous homework creation is rejected without persistent effects",
  { tag: "@Homework/REST" },
  async ({ request, homeworkState, run }) =>
    run(async () => {
      const { db, section } = homeworkState;
      const before = await db.homework.findMany({
        where: { sectionId: section.id },
      });
      const response = await request.post(base, {
        data: { title: "denied", sectionId: String(section.id) },
      });
      expect(response.status()).toBe(401);
      expect((await response.json()).error).toEqual(expect.any(String));
      expect(
        await db.homework.findMany({ where: { sectionId: section.id } }),
      ).toEqual(before);
    }),
);

test(
  "openapi.homework-created-status",
  { tag: "@Homework/REST" },
  async ({ homeworkState, run }) =>
    run(async () => {
      const { db, owner, section } = homeworkState;
      const response = await owner.request.post(base, {
        data: {
          title: "created homework",
          sectionId: String(section.id),
          publishedAt: "2026-09-01T00:00:00Z",
          submissionStartAt: "2026-09-01T00:00:00Z",
          submissionDueAt: "2100-01-01T00:00:00Z",
        },
      });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.id).toEqual(expect.any(String));
      expect(response.headers().location).toBe(`${base}/${body.id}`);
      expect(body.homework).toMatchObject({
        id: body.id,
        title: "created homework",
        commentCount: 0,
      });
      expect(
        await db.homework.findUniqueOrThrow({ where: { id: body.id } }),
      ).toMatchObject({
        title: "created homework",
        createdById: owner.id,
        sectionId: section.id,
        publishedAt: new Date("2026-09-01T00:00:00Z"),
        submissionStartAt: new Date("2026-09-01T00:00:00Z"),
        submissionDueAt: new Date("2100-01-01T00:00:00Z"),
      });
      expect(
        await db.auditLog.findMany({ where: { targetId: body.id } }),
      ).toEqual([
        expect.objectContaining({
          action: "homework_create",
          userId: owner.id,
        }),
      ]);
      const list = await owner.request.get(`${base}?sectionId=${section.id}`);
      expect(list.status()).toBe(200);
      expect((await list.json()).data).toContainEqual(
        expect.objectContaining({ id: body.id, title: "created homework" }),
      );
      const audit = await owner.request.get(
        `${base}/audit?sectionId=${section.id}`,
      );
      expect(audit.status()).toBe(200);
      expect((await audit.json()).auditLogs).toContainEqual(
        expect.objectContaining({ homeworkId: body.id }),
      );
    }),
);
