import { moderateDescription } from "@/features/admin/server/admin-api-service";
import { upsertDescriptionContent } from "@/features/descriptions/server/description-upsert";
import { getDescriptionPayload } from "@/features/descriptions/server/descriptions-server";
import { setCloudflareCatalogInvalidator } from "@/lib/adapters/cloudflare-runtime";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { purgeEntrypointCatalogCache } from "@/lib/cloudflare/public-ssr-cache-purge";
import { descriptionTest } from "../shared/description-fixture";

for (const targetType of ["course", "section", "teacher"] as const) {
  const it = descriptionTest.extend(
    "cachedDescription",
    async ({
      descriptionEditor: { user, teacher },
      isolatedDatabase: { owner: db },
      protocolRuntime,
      expect,
    }) =>
      protocolRuntime.run(async () => {
        let targetId = teacher.id;
        if (targetType !== "teacher") {
          const course = await db.course.create({
            data: {
              jwId: 1,
              code: "description-cache-course",
              nameCn: "Cache contract course",
            },
          });
          targetId = course.id;
          if (targetType === "section") {
            const section = await db.section.create({
              data: {
                jwId: 1,
                code: "description-cache-section",
                courseId: course.id,
              },
            });
            targetId = section.id;
          }
        }
        const description = await db.description.create({
          data: {
            teacherId: targetType === "teacher" ? targetId : undefined,
            courseId: targetType === "course" ? targetId : undefined,
            sectionId: targetType === "section" ? targetId : undefined,
            content: "Original description",
            lastEditedById: user.id,
          },
        });
        // Controlled cache adapter: real database, use cases and rendering, but
        // not Workers Caching. Native edge hit/purge acceptance is separate.
        let cachedHtml: string | undefined;
        let purgeCount = 0;
        const render = async () => {
          if (cachedHtml !== undefined) return cachedHtml;
          const payload = await protocolRuntime.request(async () =>
            getDescriptionPayload(
              targetType,
              targetId,
              await getViewerContext({ userId: null }),
              { includeHistory: false },
            ),
          );
          cachedHtml = payload.description.renderedHtml;
          return cachedHtml;
        };
        const request = <T>(
          action: () => Promise<T>,
          committedContent: string,
          rejectPurge = false,
        ) =>
          protocolRuntime.request(async () => {
            setCloudflareCatalogInvalidator(async () => {
              // This independent connection must see the commit before purge.
              expect(
                await db.description.findUnique({
                  where: { id: description.id },
                  select: { content: true },
                }),
              ).toEqual({ content: committedContent });
              const result = await purgeEntrypointCatalogCache({
                purge: async () => {
                  purgeCount += 1;
                  if (rejectPurge) return { success: false };
                  cachedHtml = undefined;
                  return { success: true };
                },
              });
              if (!result.ok) throw new Error("purge failed");
            });
            return action();
          });
        return {
          description,
          targetId,
          render,
          request,
          purges: () => purgeCount,
        };
      }),
  );

  it(`description cache retry preserves committed history: ${targetType}`, async ({
    cachedDescription: cache,
    descriptionEditor: { user },
    isolatedDatabase: { owner: db },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const write = () =>
        upsertDescriptionContent({
          targetType,
          targetId: cache.targetId,
          userId: user.id,
          content: "Updated description",
        });
      expect(await cache.render()).toContain("Original description");
      await expect(
        cache.request(write, "Updated description", true),
      ).rejects.toThrow("purge failed");
      expect(cache.purges()).toBe(1);
      expect(await cache.render()).toContain("Original description");
      // The failed purge does not roll back the committed write.
      expect(
        await db.description.findUnique({
          where: { id: cache.description.id },
          select: { content: true },
        }),
      ).toEqual({ content: "Updated description" });
      const history = await db.descriptionEdit.findMany({
        where: { descriptionId: cache.description.id },
      });
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        previousContent: "Original description",
        nextContent: "Updated description",
        editorId: user.id,
      });
      const audits = await db.auditLog.findMany({
        where: { targetId: cache.description.id },
      });
      expect(audits).toEqual([
        expect.objectContaining({
          action: "description_edit",
          userId: user.id,
        }),
      ]);

      await expect(
        cache.request(write, "Updated description"),
      ).resolves.toMatchObject({ ok: true, updated: false });
      expect(cache.purges()).toBe(2);
      expect(await cache.render()).toContain("Updated description");
      expect(await cache.render()).not.toContain("Original description");
      expect(
        await db.descriptionEdit.findMany({
          where: { descriptionId: cache.description.id },
        }),
      ).toEqual(history);
      expect(
        await db.auditLog.findMany({
          where: { targetId: cache.description.id },
        }),
      ).toEqual(audits);
    });
  });

  it(`description moderation clears its own cached content: ${targetType}`, async ({
    cachedDescription: cache,
    descriptionEditor: { user },
    isolatedDatabase: { owner: db },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      // Prepare the existing edit directly; moderation must not rely on an
      // earlier test or another mutation to establish its starting state.
      const prior = await db.$transaction(async (tx) => {
        const createdAt = new Date("2026-01-01T00:00:00Z");
        await tx.description.update({
          where: { id: cache.description.id },
          data: { lastEditedAt: createdAt },
        });
        const history = await tx.descriptionEdit.create({
          data: {
            descriptionId: cache.description.id,
            editorId: user.id,
            previousContent: "Earlier description",
            nextContent: "Original description",
            createdAt,
          },
        });
        const audit = await tx.auditLog.create({
          data: {
            action: "description_edit",
            userId: user.id,
            targetId: cache.description.id,
            targetType: "description",
            createdAt,
          },
        });
        return { history, audit };
      });
      expect(await cache.render()).toContain("Original description");
      await expect(
        cache.request(
          () =>
            moderateDescription(user.id, cache.description.id, { content: "" }),
          "",
        ),
      ).resolves.toMatchObject({ ok: true });
      expect(cache.purges()).toBe(1);
      expect(await cache.render()).not.toContain("Original description");
      expect(
        await db.description.findUnique({
          where: { id: cache.description.id },
          select: { content: true },
        }),
      ).toEqual({ content: "" });
      expect(
        await db.descriptionEdit.findMany({
          where: { descriptionId: cache.description.id },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        }),
      ).toEqual([
        prior.history,
        expect.objectContaining({
          previousContent: "Original description",
          nextContent: "",
          editorId: user.id,
        }),
      ]);
      expect(
        await db.auditLog.findMany({
          where: { targetId: cache.description.id },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        }),
      ).toEqual([
        prior.audit,
        expect.objectContaining({
          action: "admin_description_moderate",
          userId: user.id,
        }),
      ]);
    });
  });
}
