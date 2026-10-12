import { describe } from "vitest";
import { moderateDescription } from "@/features/admin/server/admin-api-service";
import { upsertDescriptionContent } from "@/features/descriptions/server/description-upsert";
import { getDescriptionRoute } from "@/lib/api/routes/description-read-route";
import { descriptionTest as it } from "../shared/description-fixture";

describe("description durable write contracts", () => {
  it("description.concurrent-first-write", {
    tags: ["@Description/Service"],
  }, async ({
    descriptionEditor: f,
    isolatedDatabase: { owner: db },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const contents = ["Concurrent first editor", "Concurrent second editor"];
      const results = await Promise.all(
        contents.map((content) =>
          protocolRuntime.request(() =>
            upsertDescriptionContent({
              targetType: "teacher",
              targetId: f.teacher.id,
              userId: f.user.id,
              content,
            }),
          ),
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
    });
  });

  it("description.moderation-atomicity", {
    tags: ["@Description/Service"],
  }, async ({
    descriptionEditor: f,
    isolatedDatabase: { owner: db },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
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
        protocolRuntime.request(() =>
          moderateDescription(
            f.user.id,
            description.id,
            { content: "Must roll back" },
            { requestId: "invalid\u0000request" },
          ),
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
        await protocolRuntime.request(() =>
          moderateDescription(
            f.user.id,
            description.id,
            { content: "Moderated content" },
            { channel: "web" },
          ),
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
    });
  });

  it("description.target-not-found", { tags: ["@Description/REST"] }, async ({
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      for (const target of [
        { targetType: "course", courseJwId: "2147483647" },
        { targetType: "section", sectionJwId: "2147483647" },
        { targetType: "teacher", teacherId: "2147483647" },
        {
          targetType: "homework",
          homeworkId: `missing-${crypto.randomUUID()}`,
        },
      ]) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(target)) {
          if (value !== undefined) params.set(key, value);
        }
        const response = await protocolRuntime.request(() =>
          getDescriptionRoute(
            new Request(
              `http://localhost:3000/api/community/descriptions?${params}`,
            ),
          ),
        );
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: "Target not found" });
      }
    });
  });
});
