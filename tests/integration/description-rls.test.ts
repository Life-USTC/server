import { describe, expect } from "vitest";
import { createHomeworkForSection } from "@/features/homeworks/server/homework-create";
import { updateHomework } from "@/features/homeworks/server/homework-mutations";
import { deleteOwnAccount } from "@/features/settings/server/account-deletion-service";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { rlsTest as it } from "../shared/rls-fixture";

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "Description collaborative PostgreSQL row security",
  () => {
    it("forces row security while retaining anonymous content and history reads", async ({
      isolatedDatabase: { owner, app },
      rlsActors: { firstUserId },
      rlsSections: { sectionId },
    }) => {
      const description = await owner.description.create({
        data: {
          sectionId,
          content: "Public supplement",
          lastEditedById: firstUserId,
          edits: {
            create: { editorId: firstUserId, nextContent: "Public supplement" },
          },
        },
      });
      expect(
        await app.$queryRaw`
        SELECT relname, relrowsecurity, relforcerowsecurity
        FROM pg_class JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE nspname = 'public' AND relname IN ('Description', 'DescriptionEdit')
        ORDER BY relname
      `,
      ).toEqual([
        {
          relname: "Description",
          relrowsecurity: true,
          relforcerowsecurity: true,
        },
        {
          relname: "DescriptionEdit",
          relrowsecurity: true,
          relforcerowsecurity: true,
        },
      ]);
      expect(
        await app.description.findUnique({
          where: { id: description.id },
          select: { content: true },
        }),
      ).toEqual({ content: "Public supplement" });
      expect(
        await app.descriptionEdit.findMany({
          select: { nextContent: true, editorId: true },
        }),
      ).toEqual([{ nextContent: "Public supplement", editorId: firstUserId }]);
    });

    for (const context of [
      undefined,
      "",
      "nonexistent",
      "suspended",
      "future-suspended",
    ] as const) {
      it(`rejects description and history writes with ${context ?? "missing"} context`, async ({
        isolatedDatabase: { owner, app },
        rlsActors: { firstUserId },
        rlsSections: { sectionId, writeProbeSectionId },
      }) => {
        const description = await owner.description.create({
          data: {
            sectionId,
            content: "Original",
            lastEditedById: firstUserId,
          },
        });
        const suspended =
          context === "suspended" || context === "future-suspended";
        if (suspended)
          await owner.userSuspension.create({
            data: {
              userId: firstUserId,
              expiresAt:
                context === "future-suspended"
                  ? new Date(Date.now() + 3_600_000)
                  : null,
            },
          });
        const actor = suspended ? firstUserId : context;
        await expect(
          app.$transaction(async (tx) => {
            if (context === "future-suspended")
              await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Asia/Shanghai'");
            if (actor !== undefined)
              await tx.$queryRaw`SELECT set_config('app.user_id', ${actor}, true)`;
            return tx.description.create({
              data: {
                sectionId: writeProbeSectionId,
                content: "Rejected",
                lastEditedById: firstUserId,
              },
            });
          }),
        ).rejects.toThrow(/row-level security/);
        expect(
          await app.$transaction(async (tx) => {
            if (actor !== undefined)
              await tx.$queryRaw`SELECT set_config('app.user_id', ${actor}, true)`;
            return tx.description.updateMany({
              where: { id: description.id },
              data: { content: "Rejected" },
            });
          }),
        ).toEqual({ count: 0 });
        await expect(
          app.$transaction(async (tx) => {
            if (context === "future-suspended")
              await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Asia/Shanghai'");
            if (actor !== undefined)
              await tx.$queryRaw`SELECT set_config('app.user_id', ${actor}, true)`;
            return tx.descriptionEdit.create({
              data: {
                descriptionId: description.id,
                editorId: firstUserId,
                nextContent: "Rejected",
              },
            });
          }),
        ).rejects.toThrow(/row-level security/);
        expect(
          await owner.description.findUnique({
            where: { id: description.id },
            select: { content: true },
          }),
        ).toEqual({ content: "Original" });
        expect(await owner.descriptionEdit.count()).toBe(0);
      });
    }

    it("allows collaborative editors but rejects forged attribution and immutable targets", async ({
      isolatedDatabase: { owner },
      rlsRuntime,
      rlsActors: { firstUserId, secondUserId },
      rlsSections: { sectionId, writeProbeSectionId },
    }) => {
      await rlsRuntime.run(async () => {
        const description = await withUserDbContext(firstUserId, (tx) =>
          tx.description.create({
            data: {
              sectionId,
              content: "First",
              lastEditedById: firstUserId,
            },
          }),
        );
        await withUserDbContext(secondUserId, async (tx) => {
          await tx.description.update({
            where: { id: description.id },
            data: {
              content: "Second",
              lastEditedById: secondUserId,
            },
          });
          await tx.descriptionEdit.create({
            data: {
              descriptionId: description.id,
              editorId: secondUserId,
              previousContent: "First",
              nextContent: "Second",
            },
          });
        });
        for (const forgedEditorId of [firstUserId, null]) {
          await expect(
            withUserDbContext(secondUserId, (tx) =>
              tx.description.create({
                data: {
                  sectionId: writeProbeSectionId,
                  content: "Forged",
                  lastEditedById: forgedEditorId,
                },
              }),
            ),
          ).rejects.toThrow(/row-level security/);
          await expect(
            withUserDbContext(secondUserId, (tx) =>
              tx.description.update({
                where: { id: description.id },
                data: { content: "Forged", lastEditedById: forgedEditorId },
              }),
            ),
          ).rejects.toThrow(/row-level security/);
          await expect(
            withUserDbContext(secondUserId, (tx) =>
              tx.descriptionEdit.create({
                data: {
                  descriptionId: description.id,
                  editorId: forgedEditorId,
                  nextContent: "Forged",
                },
              }),
            ),
          ).rejects.toThrow(/row-level security/);
        }
        await expect(
          withUserDbContext(secondUserId, (tx) =>
            tx.description.update({
              where: { id: description.id },
              data: { sectionId: writeProbeSectionId },
            }),
          ),
        ).rejects.toThrow(/permission denied/);
        // The preceding successful and failed transactions must not retain identity.
        expect(
          await prisma.description.updateMany({
            where: { id: description.id },
            data: { content: "Leaked" },
          }),
        ).toEqual({ count: 0 });
        expect(
          await owner.description.findUnique({
            where: { id: description.id },
            select: { content: true, lastEditedById: true },
          }),
        ).toEqual({ content: "Second", lastEditedById: secondUserId });
        expect(await owner.descriptionEdit.count()).toBe(1);
      });
    });

    it("keeps history append-only and preserves account-deletion SetNull references", async ({
      isolatedDatabase: { owner },
      rlsRuntime,
      rlsActors: { firstUserId },
      rlsSections: { sectionId },
    }) => {
      const description = await owner.description.create({
        data: {
          sectionId,
          content: "Retained",
          lastEditedById: firstUserId,
          edits: { create: { editorId: firstUserId, nextContent: "Retained" } },
        },
      });
      await rlsRuntime.run(async () => {
        for (const mutate of [
          () =>
            withUserDbContext(firstUserId, (tx) =>
              tx.descriptionEdit.updateMany({
                data: { nextContent: "Rewrite" },
              }),
            ),
          () =>
            withUserDbContext(firstUserId, (tx) =>
              tx.descriptionEdit.deleteMany({}),
            ),
          () =>
            withUserDbContext(firstUserId, (tx) =>
              tx.description.delete({ where: { id: description.id } }),
            ),
        ])
          await expect(mutate()).rejects.toThrow(/permission denied/);
      });
      const session = await owner.session.create({
        data: {
          userId: firstUserId,
          sessionToken: crypto.randomUUID(),
          expires: new Date(Date.now() + 3_600_000),
        },
      });
      await rlsRuntime.run(async () => {
        expect(
          await deleteOwnAccount(firstUserId, { sessionId: session.id }),
        ).toEqual({ ok: true });
      });
      expect(await owner.user.count({ where: { id: firstUserId } })).toBe(0);
      expect(
        await owner.description.findUnique({
          where: { id: description.id },
          select: { content: true, lastEditedById: true },
        }),
      ).toEqual({ content: "Retained", lastEditedById: null });
      expect(
        await owner.descriptionEdit.findMany({
          select: { nextContent: true, editorId: true },
        }),
      ).toEqual([{ nextContent: "Retained", editorId: null }]);
    });

    it("allows lifted and expired suspensions to collaborate through Homework descriptions", async ({
      isolatedDatabase: { owner },
      rlsRuntime,
      rlsActors: { firstUserId, secondUserId },
      rlsSections: { sectionId },
    }) => {
      await owner.userSuspension.createMany({
        data: [
          { userId: firstUserId, liftedAt: new Date() },
          { userId: secondUserId, expiresAt: new Date("2000-01-01T00:00:00Z") },
        ],
      });
      await rlsRuntime.run(async () => {
        const created = await createHomeworkForSection(firstUserId, {
          sectionId,
          title: "Collaborative homework",
          description: "Initial",
          isMajor: false,
          requiresTeam: false,
        });
        if (!created.ok)
          throw new Error(`Homework creation rejected: ${created.error}`);
        expect(
          await updateHomework({
            homeworkId: created.homework.id,
            userId: secondUserId,
            update: { description: "Revised" },
          }),
        ).toEqual({ ok: true });
        expect(
          await owner.description.findUnique({
            where: { homeworkId: created.homework.id },
            select: { content: true, lastEditedById: true },
          }),
        ).toEqual({ content: "Revised", lastEditedById: secondUserId });
        expect(
          await owner.descriptionEdit.findMany({
            orderBy: { createdAt: "asc" },
            select: {
              editorId: true,
              previousContent: true,
              nextContent: true,
            },
          }),
        ).toEqual([
          {
            editorId: firstUserId,
            previousContent: null,
            nextContent: "Initial",
          },
          {
            editorId: secondUserId,
            previousContent: "Initial",
            nextContent: "Revised",
          },
        ]);
        expect(
          await owner.auditLog.findMany({
            orderBy: { createdAt: "asc" },
            select: { action: true, userId: true },
          }),
        ).toEqual([
          { action: "homework_create", userId: firstUserId },
          { action: "description_edit", userId: secondUserId },
          { action: "homework_update", userId: secondUserId },
        ]);
      });
    });
  },
);
