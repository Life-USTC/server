import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { postCommentRoute } from "@/lib/api/routes/comments-create-route";
import { getCommentsRoute } from "@/lib/api/routes/comments-list-route";
import { patchCommentRoute } from "@/lib/api/routes/comments-update-route";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const userId = `comment-target-${marker}`;
const origin = "http://localhost:3000";
let cookie: string;
let sectionId: number;
let teacherId: number;
let youngEventId: number;
type Target = {
  type: string;
  id: string | number;
  public: Record<string, string | number>;
  column: string;
};
const targets: Target[] = [];
beforeAll(async () => {
  await db.user.create({
    data: { id: userId, email: `${userId}@example.test` },
  });
  const sessionToken = crypto.randomUUID();
  await db.session.create({
    data: { userId, sessionToken, expires: new Date(Date.now() + 3600000) },
  });
  const context = await getBetterAuthInstance().$context;
  cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${sessionToken}.${await makeSignature(sessionToken, context.secret)}`)}`;
  const source = await db.section.findFirstOrThrow({
    include: { course: true },
  });
  const section = await db.section.create({
    data: {
      courseId: source.courseId,
      semesterId: source.semesterId,
      jwId: 1_700_000_000 + Math.floor(Math.random() * 100000000),
      code: marker,
    },
  });
  sectionId = section.id;
  const teacher = await db.teacher.create({
    data: { jwId: -section.jwId, nameCn: marker },
  });
  teacherId = teacher.id;
  await db.section.update({
    where: { id: section.id },
    data: { teachers: { connect: { id: teacher.id } } },
  });
  const relationship = await db.sectionTeacher.create({
    data: { sectionId, teacherId },
  });
  const homework = await db.homework.create({
    data: { title: marker, sectionId },
  });
  const young = await db.youngEvent.create({
    data: {
      youngId: `young-${marker}`,
      name: marker,
      isActive: true,
      rawJson: {},
    },
  });
  youngEventId = young.id;
  targets.push(
    {
      type: "course",
      id: source.courseId,
      public: { courseJwId: source.course.jwId },
      column: "courseId",
    },
    {
      type: "section",
      id: sectionId,
      public: { sectionJwId: section.jwId },
      column: "sectionId",
    },
    {
      type: "teacher",
      id: teacherId,
      public: { teacherId },
      column: "teacherId",
    },
    {
      type: "homework",
      id: homework.id,
      public: { homeworkId: homework.id },
      column: "homeworkId",
    },
    {
      type: "section-teacher",
      id: relationship.id,
      public: { sectionTeacherId: relationship.id },
      column: "sectionTeacherId",
    },
    {
      type: "young-event",
      id: young.id,
      public: { youngId: young.youngId },
      column: "youngEventId",
    },
  );
});
afterAll(async () => {
  await db.auditLog.deleteMany({ where: { userId } });
  await db.comment.deleteMany({ where: { userId } });
  await db.section.deleteMany({ where: { id: sectionId } });
  await db.teacher.deleteMany({ where: { id: teacherId } });
  await db.youngEvent.deleteMany({ where: { id: youngEventId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});
function request(body: unknown, method = "POST") {
  return new Request(`${origin}/api/community/comments`, {
    method,
    headers: { cookie, origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function read(params: Record<string, string | number>) {
  return getCommentsRoute(
    new Request(
      `${origin}/api/community/comments?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`,
    ),
  );
}
async function create(target: Target, extra: Record<string, unknown> = {}) {
  const response = await postCommentRoute(
    request({
      targetType: target.type,
      ...target.public,
      body: marker,
      ...extra,
    }),
  );
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(201);
  return body.id as string;
}

it("comment.attached-to-object", async () => {
  const before = await db.comment.count({ where: { userId } });
  const inputs: Record<string, string | number>[] = [
    {},
    { targetType: "section" },
    { targetId: sectionId },
  ];
  for (const input of inputs) {
    expect(
      (await postCommentRoute(request({ ...input, body: marker }))).status,
    ).toBe(400);
    expect((await read(input)).status).toBe(400);
  }
  expect(await db.comment.count({ where: { userId } })).toBe(before);
});

it("comment.attached-object-types", async () => {
  for (const target of targets) {
    const id = await create(target);
    const row = await db.comment.findUniqueOrThrow({ where: { id } });
    expect(row).toHaveProperty(target.column, target.id);
    expect(
      targets.filter(({ column }) => row[column as keyof typeof row] !== null),
    ).toHaveLength(1);
  }
  const before = await db.comment.count({ where: { userId } });
  for (const type of ["user", "publication", "room", "unsupported"]) {
    expect(
      (
        await postCommentRoute(
          request({ targetType: type, targetId: 1, body: marker }),
        )
      ).status,
    ).toBe(400);
  }
  for (const target of targets) {
    const publicKey = Object.keys(target.public)[0];
    const missing =
      typeof target.public[publicKey] === "number"
        ? 2147483647
        : `missing-${marker}`;
    expect(
      (
        await postCommentRoute(
          request({
            targetType: target.type,
            [publicKey]: missing,
            body: marker,
          }),
        )
      ).status,
    ).toBe(404);
  }
  expect(await db.comment.count({ where: { userId } })).toBe(before);
});

it("comment.target-identifiers", async () => {
  for (const target of targets) {
    const id = await create(target);
    const byPublic = await read({ targetType: target.type, ...target.public });
    expect(byPublic.status).toBe(200);
    const publicBody = await byPublic.json();
    expect(publicBody.data.some((row: { id: string }) => row.id === id)).toBe(
      true,
    );
    const byCanonical = await read({
      targetType: target.type,
      targetId: target.id,
    });
    if (target.type === "young-event") {
      expect(byCanonical.status).toBe(400);
      expect(
        (
          await postCommentRoute(
            request({
              targetType: target.type,
              targetId: target.id,
              ...target.public,
              body: marker,
            }),
          )
        ).status,
      ).toBe(400);
    } else {
      expect(byCanonical.status).toBe(200);
      expect((await byCanonical.json()).data).toEqual(publicBody.data);
      const created = await postCommentRoute(
        request({ targetType: target.type, targetId: target.id, body: marker }),
      );
      expect(created.status, await created.clone().text()).toBe(201);
    }
  }
});

it("comment.target-not-found", async () => {
  for (const target of targets) {
    const publicKey = Object.keys(target.public)[0];
    const missing =
      typeof target.public[publicKey] === "number"
        ? 2147483647
        : `missing-${marker}`;
    const response = await read({
      targetType: target.type,
      [publicKey]: missing,
    });
    expect(response.status).toBe(404);
    expect(await response.json()).not.toHaveProperty("data");
  }
});

it("comment.public-id-validation", async () => {
  for (const target of targets.filter((t) =>
    ["section", "course"].includes(t.type),
  )) {
    const key = Object.keys(target.public)[0];
    for (const value of ["0", "-1", "1.5", "abc", "", "9007199254740992"]) {
      const params = {
        targetType: target.type,
        targetId: target.id,
        [key]: value,
      };
      expect((await read(params)).status, `${key}=${value}`).toBe(400);
      expect(
        (await postCommentRoute(request({ ...params, body: marker }))).status,
      ).toBe(400);
    }
  }
});

it("comment.visibility-input", async () => {
  const target = targets[1];
  for (const visibility of ["public", "logged_in_only"])
    for (const isAnonymous of [true, false]) {
      const id = await create(target, { visibility, isAnonymous });
      expect(await db.comment.findUnique({ where: { id } })).toMatchObject({
        visibility,
        isAnonymous,
      });
      const nextVisibility =
        visibility === "public" ? "logged_in_only" : "public";
      const updated = await patchCommentRoute(
        request(
          {
            body: marker,
            visibility: nextVisibility,
            isAnonymous: !isAnonymous,
          },
          "PATCH",
        ),
        { id },
      );
      expect(updated.status, await updated.clone().text()).toBe(200);
      expect(await db.comment.findUnique({ where: { id } })).toMatchObject({
        visibility: nextVisibility,
        isAnonymous: !isAnonymous,
      });
      for (const invalid of ["anonymous", "private", "", null, 7]) {
        expect(
          (
            await postCommentRoute(
              request({
                targetType: target.type,
                ...target.public,
                body: marker,
                visibility: invalid,
              }),
            )
          ).status,
        ).toBe(400);
        expect(
          (
            await patchCommentRoute(
              request(
                { body: "must not persist", visibility: invalid },
                "PATCH",
              ),
              { id },
            )
          ).status,
        ).toBe(400);
      }
      expect(await db.comment.findUnique({ where: { id } })).toMatchObject({
        body: marker,
        visibility: nextVisibility,
        isAnonymous: !isAnonymous,
      });
    }
});

it("comment.section-teacher-target-lifecycle", async () => {
  await db.sectionTeacher.deleteMany({ where: { sectionId, teacherId } });
  const pair = {
    targetType: "section-teacher",
    sectionId,
    teacherId,
    body: marker,
  };
  const response = await postCommentRoute(request(pair));
  expect(response.status, await response.clone().text()).toBe(201);
  const target = await db.sectionTeacher.findUniqueOrThrow({
    where: { sectionId_teacherId: { sectionId, teacherId } },
  });
  expect(target.retiredAt).toBeNull();
  await db.sectionTeacher.update({
    where: { id: target.id },
    data: { retiredAt: new Date() },
  });
  expect((await postCommentRoute(request(pair))).status).toBe(201);
  expect(
    await db.sectionTeacher.findUnique({ where: { id: target.id } }),
  ).toMatchObject({ retiredAt: null, sectionId, teacherId });
  await expect(
    runtimePrisma.sectionTeacher.update({
      where: { id: target.id },
      data: { sectionId },
    }),
  ).rejects.toThrow();
  await expect(
    runtimePrisma.sectionTeacher.delete({ where: { id: target.id } }),
  ).rejects.toThrow();
  await db.section.update({
    where: { id: sectionId },
    data: { teachers: { disconnect: { id: teacherId } } },
  });
  await db.sectionTeacher.update({
    where: { id: target.id },
    data: { retiredAt: new Date() },
  });
  expect((await postCommentRoute(request(pair))).status).toBe(404);
  expect(
    (await db.sectionTeacher.findUniqueOrThrow({ where: { id: target.id } }))
      .retiredAt,
  ).not.toBeNull();
});
