import { readFileSync } from "node:fs";
import { Client } from "pg";
import { describe, expect } from "vitest";
import { createComment } from "@/features/comments/server/comment-create";
import { updateOwnComment } from "@/features/comments/server/comment-update-delete";
import { deleteOwnAccount } from "@/features/settings/server/account-deletion-service";
import { rlsTest } from "../shared/rls-fixture";

const it = rlsTest.extend<{
  attachments: {
    links: Record<"public" | "loggedIn" | "softbanned" | "deleted", string>;
    ownUploadId: string;
    foreignUploadId: string;
    foreignCommentId: string;
  };
}>({
  attachments: async (
    {
      isolatedDatabase: { owner },
      rlsActors: { firstUserId, secondUserId },
      rlsComments,
      rlsSections: { sectionId },
    },
    use,
  ) => {
    const links = {} as Record<keyof typeof rlsComments, string>;
    for (const [kind, commentId] of Object.entries(rlsComments)) {
      const upload = await owner.upload.create({
        data: {
          userId: firstUserId,
          filename: `${kind}.txt`,
          contentType: "text/plain",
          key: `uploads/${kind}.txt`,
          size: 5,
        },
      });
      await owner.commentAttachment.create({
        data: { commentId, uploadId: upload.id },
      });
      links[kind as keyof typeof links] = upload.id;
    }
    const uploads = await Promise.all(
      [firstUserId, secondUserId].map((userId) =>
        owner.upload.create({
          data: {
            userId,
            filename: `${userId}.txt`,
            key: `uploads/${userId}.txt`,
            size: 5,
          },
        }),
      ),
    );
    const foreignComment = await owner.comment.create({
      data: { userId: secondUserId, sectionId, body: "Foreign comment" },
    });
    await use({
      links,
      ownUploadId: uploads[0].id,
      foreignUploadId: uploads[1].id,
      foreignCommentId: foreignComment.id,
    });
  },
});

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "CommentAttachment PostgreSQL row security",
  { tags: ["@Comment/Permissions"] },
  () => {
    it("applies the migration to existing links without changing their contents", async ({
      isolatedDatabase: { owner, app, connections },
      rlsComments: { public: commentId },
      attachments: { ownUploadId },
    }) => {
      const migration = new Client({ connectionString: connections.owner });
      await migration.connect();
      try {
        await migration.query(`
          DROP POLICY "CommentAttachment_visible_parent" ON public."CommentAttachment";
          DROP POLICY "CommentAttachment_author_insert" ON public."CommentAttachment";
          DROP POLICY "CommentAttachment_author_delete" ON public."CommentAttachment";
          ALTER TABLE public."CommentAttachment" DISABLE ROW LEVEL SECURITY;
          ALTER TABLE public."CommentAttachment" NO FORCE ROW LEVEL SECURITY;
        `);
        const before = await owner.commentAttachment.findMany({
          orderBy: { id: "asc" },
        });
        expect(await app.commentAttachment.count()).toBe(4);
        await migration.query(
          readFileSync(
            "prisma/migrations/20261103130000_comment_attachment_rls/migration.sql",
            "utf8",
          ),
        );
        expect(await app.commentAttachment.count()).toBe(1);
        await expect(
          app.commentAttachment.create({
            data: { commentId, uploadId: ownUploadId },
          }),
        ).rejects.toThrow(/row-level security/);
        expect(
          await owner.commentAttachment.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(before);
      } finally {
        await migration.end();
      }
    });

    it("forces parent visibility while preserving public summaries and authorized downloads", async ({
      isolatedDatabase: { app },
      rlsActors: { firstUserId, secondUserId, adminUserId },
      rlsComments,
      attachments: { links },
    }) => {
      const [table] = await app.$queryRaw<
        { enabled: boolean; forced: boolean }[]
      >`SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced
        FROM pg_class WHERE oid = 'public."CommentAttachment"'::regclass`;
      expect(table).toEqual({ enabled: true, forced: true });
      const policies = await app.$queryRaw<{ cmd: string }[]>`
        SELECT cmd FROM pg_policies WHERE schemaname = 'public'
          AND tablename = 'CommentAttachment' ORDER BY cmd`;
      expect(policies.map(({ cmd }) => cmd)).toEqual([
        "DELETE",
        "INSERT",
        "SELECT",
      ]);
      for (const [actor, visible, summarized, downloadable] of [
        [undefined, ["public"], ["public"], []],
        [
          secondUserId,
          ["public", "loggedIn"],
          ["public", "loggedIn"],
          ["public", "loggedIn"],
        ],
        [
          firstUserId,
          ["public", "loggedIn", "softbanned", "deleted"],
          ["public", "loggedIn", "softbanned"],
          ["public", "loggedIn", "softbanned", "deleted"],
        ],
        [
          adminUserId,
          ["public", "loggedIn", "softbanned", "deleted"],
          ["public", "loggedIn", "softbanned"],
          ["public", "loggedIn", "softbanned"],
        ],
      ] as const) {
        await app.$transaction(async (tx) => {
          if (actor)
            await tx.$queryRaw`SELECT set_config('app.user_id', ${actor}, true)`;
          const raw = await tx.commentAttachment.findMany();
          expect(raw.map(({ uploadId }) => uploadId).sort()).toEqual(
            visible.map((kind) => links[kind]).sort(),
          );
          const summaries = await tx.$queryRaw<{ uploadId: string }[]>`
            SELECT "uploadId" FROM public.comment_attachment_summaries(${Object.values(rlsComments)}::text[])`;
          expect(summaries.map(({ uploadId }) => uploadId).sort()).toEqual(
            summarized.map((kind) => links[kind]).sort(),
          );
          for (const kind of Object.keys(links) as (keyof typeof links)[]) {
            const rows = await tx.$queryRaw<unknown[]>`
              SELECT * FROM public.find_downloadable_upload(${links[kind]})`;
            expect(rows.length).toBe(
              (downloadable as readonly string[]).includes(kind) ? 1 : 0,
            );
          }
          expect(await tx.upload.count()).toBe(
            actor === firstUserId ? 5 : actor === secondUserId ? 1 : 0,
          );
        });
      }
      expect(await app.commentAttachment.count()).toBe(1);
      expect(await app.upload.count()).toBe(0);
    });

    for (const context of [
      undefined,
      "",
      "nonexistent",
      "suspended",
      "future-suspended",
    ] as const) {
      it(`rejects attachment writes with ${context ?? "missing"} context`, async ({
        isolatedDatabase: { owner, app },
        rlsActors: { firstUserId },
        rlsComments: { public: commentId },
        attachments: { ownUploadId },
      }) => {
        const suspended =
          context === "suspended" || context === "future-suspended";
        if (suspended)
          await owner.userSuspension.create({
            data: {
              userId: firstUserId,
              expiresAt:
                context === "future-suspended"
                  ? new Date(Date.now() + 3600000)
                  : null,
            },
          });
        const actor = suspended ? firstUserId : context;
        const before = await owner.commentAttachment.findMany({
          orderBy: { id: "asc" },
        });
        await expect(
          app.$transaction(async (tx) => {
            await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Asia/Shanghai'");
            if (actor !== undefined)
              await tx.$queryRaw`SELECT set_config('app.user_id', ${actor}, true)`;
            return tx.commentAttachment.create({
              data: { commentId, uploadId: ownUploadId },
            });
          }),
        ).rejects.toThrow(/row-level security/);
        expect(
          await app.$transaction(async (tx) => {
            if (actor !== undefined)
              await tx.$queryRaw`SELECT set_config('app.user_id', ${actor}, true)`;
            return tx.commentAttachment.deleteMany({ where: { commentId } });
          }),
        ).toEqual({ count: 0 });
        expect(
          await owner.commentAttachment.findMany({ orderBy: { id: "asc" } }),
        ).toEqual(before);
      });
    }

    it("rejects foreign uploads, foreign or locked parents and link retargeting", async ({
      isolatedDatabase: { owner, app },
      rlsActors: { firstUserId, secondUserId, adminUserId },
      rlsComments,
      attachments: { ownUploadId, foreignUploadId, foreignCommentId, links },
    }) => {
      const before = await owner.commentAttachment.findMany({
        orderBy: { id: "asc" },
      });
      for (const [actor, commentId, uploadId] of [
        [firstUserId, rlsComments.public, foreignUploadId],
        [secondUserId, rlsComments.public, foreignUploadId],
        [adminUserId, rlsComments.public, ownUploadId],
        [firstUserId, foreignCommentId, ownUploadId],
        [firstUserId, rlsComments.softbanned, ownUploadId],
        [firstUserId, rlsComments.deleted, ownUploadId],
        [firstUserId, "missing", ownUploadId],
        [firstUserId, rlsComments.public, "missing"],
      ]) {
        await expect(
          app.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT set_config('app.user_id', ${actor}, true)`;
            return tx.commentAttachment.create({
              data: { commentId, uploadId },
            });
          }),
        ).rejects.toThrow(/row-level security/);
      }
      for (const [actor, commentId] of [
        [secondUserId, rlsComments.public],
        [adminUserId, rlsComments.public],
        [firstUserId, rlsComments.softbanned],
        [firstUserId, rlsComments.deleted],
      ]) {
        expect(
          await app.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT set_config('app.user_id', ${actor}, true)`;
            return tx.commentAttachment.deleteMany({ where: { commentId } });
          }),
        ).toEqual({ count: 0 });
      }
      await expect(
        app.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT set_config('app.user_id', ${firstUserId}, true)`;
          return tx.commentAttachment.updateMany({
            data: { commentId: foreignCommentId },
          });
        }),
      ).rejects.toThrow(/permission denied/);
      await expect(
        app.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT set_config('app.user_id', ${firstUserId}, true)`;
          return tx.commentAttachment.createMany({
            data: [
              { commentId: rlsComments.public, uploadId: ownUploadId },
              { commentId: rlsComments.public, uploadId: foreignUploadId },
            ],
          });
        }),
      ).rejects.toThrow(/row-level security/);
      await expect(
        app.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT set_config('app.user_id', ${firstUserId}, true)`;
          return tx.commentAttachment.create({
            data: { commentId: rlsComments.loggedIn, uploadId: links.public },
          });
        }),
      ).rejects.toThrow(/Unique constraint/);
      expect(
        await owner.commentAttachment.findMany({ orderBy: { id: "asc" } }),
      ).toEqual(before);
    });

    it("creates, retains, replaces and detaches through the real comment services", async ({
      isolatedDatabase: { owner },
      rlsRuntime,
      rlsActors: { firstUserId },
      rlsSections: { sectionId },
      attachments: { ownUploadId, links },
    }) => {
      await owner.userSuspension.createMany({
        data: [
          { userId: firstUserId, liftedAt: new Date() },
          { userId: firstUserId, expiresAt: new Date(0) },
        ],
      });
      const replacement = await owner.upload.create({
        data: {
          userId: firstUserId,
          filename: "replacement.txt",
          key: "uploads/replacement.txt",
          size: 8,
        },
      });
      const uploads = await owner.upload.findMany({ orderBy: { id: "asc" } });
      await rlsRuntime.run(async () => {
        const input = {
          content: "Attached comment",
          isAnonymous: false,
          rawTargetId: sectionId,
          targetType: "section" as const,
          userId: firstUserId,
          visibility: "public" as const,
        };
        const occupied = await createComment({
          ...input,
          attachmentIds: [links.deleted],
        });
        expect(occupied).toMatchObject({
          ok: false,
          error: "invalid_attachments",
        });
        const created = await createComment({
          ...input,
          attachmentIds: [ownUploadId],
        });
        if (!created.ok) throw new Error(created.error);
        const id = created.comment.id;
        for (const attachmentIds of [[ownUploadId], [replacement.id], []]) {
          const result = await updateOwnComment({
            attachmentIds,
            hasAttachmentUpdate: true,
            id,
            userId: firstUserId,
          });
          expect(result).toMatchObject({ ok: true });
          expect(
            await owner.commentAttachment.findMany({
              where: { commentId: id },
              select: { uploadId: true },
            }),
          ).toEqual(attachmentIds.map((uploadId) => ({ uploadId })));
        }
      });
      expect(await owner.upload.findMany({ orderBy: { id: "asc" } })).toEqual(
        uploads,
      );
    });

    it("keeps upload, account and catalog foreign-key cleanup available", async ({
      isolatedDatabase: { owner, app },
      rlsRuntime,
      rlsActors: { firstUserId, secondUserId },
      rlsSections: { sectionId },
      attachments: { links, foreignUploadId, foreignCommentId },
    }) => {
      await owner.commentAttachment.create({
        data: { uploadId: foreignUploadId, commentId: foreignCommentId },
      });
      await app.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.user_id', ${firstUserId}, true)`;
        await tx.upload.delete({ where: { id: links.deleted } });
      });
      expect(await owner.commentAttachment.count()).toBe(4);
      const session = await owner.session.create({
        data: {
          userId: firstUserId,
          sessionToken: crypto.randomUUID(),
          expires: new Date(Date.now() + 3600000),
        },
      });
      await rlsRuntime.run(async () => {
        expect(
          await deleteOwnAccount(firstUserId, { sessionId: session.id }),
        ).toEqual({ ok: true });
      });
      expect(await owner.upload.count({ where: { userId: firstUserId } })).toBe(
        0,
      );
      expect(
        await owner.commentAttachment.findMany({ select: { uploadId: true } }),
      ).toEqual([{ uploadId: foreignUploadId }]);
      expect(
        await owner.comment.count({ where: { userId: secondUserId } }),
      ).toBe(1);
      await owner.section.delete({ where: { id: sectionId } });
      expect(await owner.commentAttachment.count()).toBe(0);
      expect(await owner.upload.count()).toBe(1);
    });
  },
);
