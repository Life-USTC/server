import { afterAll, describe, expect, it } from "vitest";
import { moderateDescription } from "@/features/admin/server/admin-api-service";
import { upsertDescriptionContent } from "@/features/descriptions/server/description-upsert";
import { getDescriptionRoute } from "@/lib/api/routes/description-read-route";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
afterAll(async () =>
  Promise.all([db.$disconnect(), runtimePrisma.$disconnect()]),
);

async function fixture() {
  const marker = crypto.randomUUID();
  const user = await db.user.create({
    data: {
      name: "Description contract editor",
      email: `${marker}@example.test`,
      isAdmin: true,
    },
  });
  const teacher = await db.teacher.create({
    data: {
      jwId: -Math.floor(Math.random() * 1_000_000_000) - 1,
      nameCn: `[integration-test] ${marker}`,
    },
  });
  return {
    user,
    teacher,
    async cleanup() {
      await db.auditLog.deleteMany({ where: { userId: user.id } });
      await db.description.deleteMany({ where: { teacherId: teacher.id } });
      await db.teacher.delete({ where: { id: teacher.id } });
      await db.user.delete({ where: { id: user.id } });
    },
  };
}

describe("description durable write contracts", () => {
  it("description.concurrent-first-write", async () => {
    const f = await fixture();
    try {
      const contents = ["Concurrent first editor", "Concurrent second editor"];
      const results = await Promise.all(
        contents.map((content) =>
          upsertDescriptionContent({
            targetType: "teacher",
            targetId: f.teacher.id,
            userId: f.user.id,
            content,
          }),
        ),
      );
      for (const result of results)
        expect(result).toMatchObject({ ok: true, updated: true });
      const descriptions = await db.description.findMany({
        where: { teacherId: f.teacher.id },
      });
      expect(descriptions).toHaveLength(1);
      expect(contents).toContain(descriptions[0].content);
      const edits = await db.descriptionEdit.findMany({
        where: { descriptionId: descriptions[0].id },
      });
      expect(edits).toHaveLength(2);
      expect(edits.map((edit) => edit.nextContent).sort()).toEqual(
        contents.sort(),
      );
      expect(
        await db.auditLog.count({
          where: { targetId: descriptions[0].id, action: "description_edit" },
        }),
      ).toBe(2);
    } finally {
      await f.cleanup();
    }
  });

  it("description.moderation-atomicity", async () => {
    const f = await fixture();
    try {
      const description = await db.description.create({
        data: {
          teacherId: f.teacher.id,
          content: "Before moderation",
          lastEditedById: f.user.id,
        },
      });
      // Only the audit write stores requestId. PostgreSQL rejects a NUL byte,
      // so this fails after content and history writes inside the transaction.
      await expect(
        moderateDescription(
          f.user.id,
          description.id,
          { content: "Must roll back" },
          { requestId: "invalid\u0000request" },
        ),
      ).rejects.toThrow();
      expect(
        await db.description.findUnique({
          where: { id: description.id },
          select: { content: true },
        }),
      ).toEqual({ content: "Before moderation" });
      expect(
        await db.descriptionEdit.count({
          where: { descriptionId: description.id },
        }),
      ).toBe(0);
      expect(
        await db.auditLog.count({ where: { targetId: description.id } }),
      ).toBe(0);

      expect(
        await moderateDescription(
          f.user.id,
          description.id,
          { content: "Moderated content" },
          { channel: "web" },
        ),
      ).toMatchObject({ ok: true });
      expect(
        await db.description.findUnique({
          where: { id: description.id },
          select: { content: true, lastEditedById: true },
        }),
      ).toEqual({ content: "Moderated content", lastEditedById: f.user.id });
      expect(
        await db.descriptionEdit.findMany({
          where: { descriptionId: description.id },
          select: { previousContent: true, nextContent: true, editorId: true },
        }),
      ).toEqual([
        {
          previousContent: "Before moderation",
          nextContent: "Moderated content",
          editorId: f.user.id,
        },
      ]);
      expect(
        await db.auditLog.findMany({
          where: { targetId: description.id },
          select: { action: true, channel: true, userId: true },
        }),
      ).toEqual([
        {
          action: "admin_description_moderate",
          channel: "web",
          userId: f.user.id,
        },
      ]);
    } finally {
      await f.cleanup();
    }
  });

  it("description.target-not-found", async () => {
    for (const target of [
      { targetType: "course", courseJwId: "2147483647" },
      { targetType: "section", sectionJwId: "2147483647" },
      { targetType: "teacher", teacherId: "2147483647" },
      { targetType: "homework", homeworkId: `missing-${crypto.randomUUID()}` },
    ]) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(target)) {
        if (value !== undefined) params.set(key, value);
      }
      const response = await getDescriptionRoute(
        new Request(
          `http://localhost:3000/api/community/descriptions?${params}`,
        ),
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Target not found" });
    }
  });
});
