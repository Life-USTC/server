import { readFileSync } from "node:fs";
import { Client } from "pg";
import { describe, expect } from "vitest";
import { createHomeworkForSection } from "@/features/homeworks/server/homework-create";
import {
  deleteHomework,
  deleteHomeworkForModeration,
  updateHomework,
} from "@/features/homeworks/server/homework-mutations";
import { deleteOwnAccount } from "@/features/settings/server/account-deletion-service";
import { rlsTest as it } from "../shared/rls-fixture";

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "Homework collaborative PostgreSQL row security",
  { tags: ["@Homework/Permissions"] },
  () => {
    it("upgrades existing broad grants without rerunning role bootstrap", async ({
      isolatedDatabase: { app, connections },
      rlsActors: { firstUserId },
      rlsHomework: { homeworkId },
    }) => {
      const owner = new Client({ connectionString: connections.owner });
      await owner.connect();
      try {
        await owner.query(`
          DROP POLICY "Homework_public_read" ON public."Homework";
          DROP POLICY "Homework_active_insert" ON public."Homework";
          DROP POLICY "Homework_active_update" ON public."Homework";
          ALTER TABLE public."Homework" DISABLE ROW LEVEL SECURITY;
          GRANT UPDATE ON TABLE public."Homework" TO life_ustc_runtime;
        `);
        expect(
          await app.homework.updateMany({
            where: { id: homeworkId },
            data: { title: "Before boundary" },
          }),
        ).toEqual({ count: 1 });
        await owner.query(
          readFileSync(
            "prisma/migrations/20261103120000_homework_collaborative_rls/migration.sql",
            "utf8",
          ),
        );
        expect(
          await app.homework.updateMany({
            where: { id: homeworkId },
            data: { title: "After boundary" },
          }),
        ).toEqual({ count: 0 });
        await expect(
          app.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT set_config('app.user_id', ${firstUserId}, true)`;
            return tx.homework.update({
              where: { id: homeworkId },
              data: { createdById: firstUserId },
            });
          }),
        ).rejects.toThrow(/permission denied/);
      } finally {
        await owner.end();
      }
    });

    for (const context of [
      undefined,
      "",
      "nonexistent",
      "suspended",
      "future-suspended",
    ] as const) {
      it(`rejects writes with ${context ?? "missing"} context`, async ({
        isolatedDatabase: { owner, app },
        rlsActors: { firstUserId },
        rlsSections: { sectionId },
        rlsHomework: { homeworkId },
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
        await expect(
          app.$transaction(async (tx) => {
            await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Asia/Shanghai'");
            if (actor !== undefined)
              await tx.$queryRaw`SELECT set_config('app.user_id', ${actor}, true)`;
            return tx.homework.create({
              data: {
                title: "Rejected",
                sectionId,
                createdById: firstUserId,
                updatedById: firstUserId,
              },
            });
          }),
        ).rejects.toThrow(/row-level security/);
        expect(
          await app.$transaction(async (tx) => {
            if (actor !== undefined)
              await tx.$queryRaw`SELECT set_config('app.user_id', ${actor}, true)`;
            return tx.homework.updateMany({
              where: { id: homeworkId },
              data: {
                title: "Rejected",
                updatedById: firstUserId,
              },
            });
          }),
        ).toEqual({ count: 0 });
        expect(await owner.homework.count()).toBe(1);
        expect(
          (
            await owner.homework.findUniqueOrThrow({
              where: { id: homeworkId },
            })
          ).title,
        ).toBe("RLS homework completion fixture");
      });
    }

    it("preserves public reads, collaborative writes and immutable attribution", async ({
      isolatedDatabase: { owner, app },
      rlsRuntime,
      rlsActors: { firstUserId, secondUserId },
      rlsSections: { sectionId, writeProbeSectionId },
    }) => {
      const [security] = await app.$queryRaw<
        { enabled: boolean; forced: boolean }[]
      >`
        SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced
        FROM pg_class WHERE oid = 'public."Homework"'::regclass`;
      expect(security).toEqual({ enabled: true, forced: true });
      await owner.userSuspension.createMany({
        data: [
          { userId: firstUserId, liftedAt: new Date() },
          { userId: secondUserId, expiresAt: new Date("2000-01-01T00:00:00Z") },
        ],
      });
      await rlsRuntime.run(async () => {
        const result = await createHomeworkForSection(firstUserId, {
          sectionId,
          title: "Shared",
          isMajor: false,
          requiresTeam: false,
        });
        if (!result.ok) throw new Error(result.error);
        const id = result.homework.id;
        expect(
          await updateHomework({
            homeworkId: id,
            userId: secondUserId,
            update: { homeworkUpdates: { title: "Collaborative" } },
          }),
        ).toEqual({ ok: true });
        expect(
          await app.homework.findUnique({
            where: { id },
            select: { title: true },
          }),
        ).toEqual({ title: "Collaborative" });
        for (const data of [
          { createdById: secondUserId },
          { sectionId: writeProbeSectionId },
          { id: "moved" },
          { createdAt: new Date(0) },
        ]) {
          await expect(
            app.$transaction(async (tx) => {
              await tx.$queryRaw`SELECT set_config('app.user_id', ${secondUserId}, true)`;
              return tx.homework.update({ where: { id }, data });
            }),
          ).rejects.toThrow(/permission denied/);
        }
        for (const forged of [firstUserId, null]) {
          await expect(
            app.$transaction(async (tx) => {
              await tx.$queryRaw`SELECT set_config('app.user_id', ${secondUserId}, true)`;
              return tx.homework.update({
                where: { id },
                data: { title: "Forged", updatedById: forged },
              });
            }),
          ).rejects.toThrow(/row-level security/);
          await expect(
            app.$transaction(async (tx) => {
              await tx.$queryRaw`SELECT set_config('app.user_id', ${secondUserId}, true)`;
              return tx.homework.create({
                data: {
                  title: "Forged",
                  sectionId,
                  createdById: forged,
                  updatedById: secondUserId,
                },
              });
            }),
          ).rejects.toThrow(/row-level security/);
        }
        expect(
          await app.homework.updateMany({
            where: { id },
            data: { title: "Leaked", updatedById: secondUserId },
          }),
        ).toEqual({ count: 0 });
        expect(
          await owner.homework.findUnique({
            where: { id },
            select: { title: true, createdById: true, updatedById: true },
          }),
        ).toEqual({
          title: "Collaborative",
          createdById: firstUserId,
          updatedById: secondUserId,
        });
      });
    });

    it("rejects collaborator deletion and forged tombstones while preserving creator replay and admin moderation", async ({
      isolatedDatabase: { owner, app },
      rlsRuntime,
      rlsActors: { firstUserId, secondUserId, adminUserId },
      rlsHomework: { homeworkId },
      rlsSections: { sectionId },
    }) => {
      for (const actor of [secondUserId, firstUserId]) {
        await expect(
          app.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT set_config('app.user_id', ${actor}, true)`;
            return tx.homework.update({
              where: { id: homeworkId },
              data: {
                deletedAt: new Date(),
                deletedById: actor === firstUserId ? secondUserId : actor,
                updatedById: actor,
              },
            });
          }),
        ).rejects.toThrow(/row-level security/);
      }
      await expect(
        app.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT set_config('app.user_id', ${firstUserId}, true)`;
          return tx.homework.create({
            data: {
              title: "Pre-deleted",
              sectionId,
              createdById: firstUserId,
              updatedById: firstUserId,
              deletedAt: new Date(),
              deletedById: firstUserId,
            },
          });
        }),
      ).rejects.toThrow(/row-level security/);
      await rlsRuntime.run(async () => {
        expect(
          await deleteHomework({ homeworkId, userId: secondUserId }),
        ).toEqual({ ok: false, error: "forbidden" });
        expect(
          await deleteHomework({ homeworkId, userId: adminUserId }),
        ).toEqual({ ok: false, error: "forbidden" });
        expect(
          await deleteHomeworkForModeration({
            homeworkId,
            userId: secondUserId,
          }),
        ).toEqual({ ok: false, error: "forbidden" });
        expect(
          await deleteHomework({ homeworkId, userId: firstUserId }),
        ).toEqual({ ok: true, alreadyDeleted: false });
        const tombstone = await owner.homework.findUniqueOrThrow({
          where: { id: homeworkId },
        });
        expect(
          await deleteHomework({ homeworkId, userId: firstUserId }),
        ).toEqual({ ok: true, alreadyDeleted: true });
        expect(
          await owner.homework.findUnique({ where: { id: homeworkId } }),
        ).toEqual(tombstone);
        expect(tombstone.deletedById).toBe(firstUserId);
        expect(tombstone.deletedAt).toBeInstanceOf(Date);
        for (const actor of [firstUserId, adminUserId]) {
          expect(
            await app.$transaction(async (tx) => {
              await tx.$queryRaw`SELECT set_config('app.user_id', ${actor}, true)`;
              return tx.homework.updateMany({
                where: { id: homeworkId },
                data: {
                  deletedAt: null,
                  deletedById: null,
                  updatedById: actor,
                },
              });
            }),
          ).toEqual({ count: 0 });
        }
        const moderated = await owner.homework.create({
          data: { title: "Moderate", sectionId, createdById: firstUserId },
        });
        expect(
          await deleteHomeworkForModeration({
            homeworkId: moderated.id,
            userId: adminUserId,
          }),
        ).toEqual({ ok: true, alreadyDeleted: false });
        expect(
          (
            await owner.homework.findUniqueOrThrow({
              where: { id: moderated.id },
            })
          ).deletedById,
        ).toBe(adminUserId);
        expect(
          await owner.auditLog.count({ where: { action: "homework_delete" } }),
        ).toBe(2);
      });
      expect(await app.homework.count()).toBe(2);
      await expect(app.homework.deleteMany()).rejects.toThrow(
        /permission denied/,
      );
    });

    it("joins concurrent deletion replays after the first tombstone commits", async ({
      isolatedDatabase: { owner, connections },
      rlsRuntime,
      rlsActors: { firstUserId, adminUserId },
      rlsHomework: { homeworkId },
    }) => {
      const blocker = new Client({ connectionString: connections.owner });
      await blocker.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query(
          'SELECT id FROM public."Homework" WHERE id = $1 FOR UPDATE',
          [homeworkId],
        );
        await rlsRuntime.run(async () => {
          const pending = [
            deleteHomework({ homeworkId, userId: firstUserId }),
            deleteHomeworkForModeration({ homeworkId, userId: adminUserId }),
          ];
          // Attach both error handlers before observing the blocked writers.
          const settled = Promise.allSettled(pending);
          try {
            await expect
              .poll(
                async () => {
                  await blocker.query("SELECT pg_stat_clear_snapshot()");
                  const result = await blocker.query<{ count: number }>(`
                SELECT count(*)::integer AS count FROM pg_stat_activity
                WHERE datname = current_database() AND usename = 'life_ustc_runtime'
                  AND wait_event_type = 'Lock' AND query LIKE '%UPDATE%Homework%'
              `);
                  return result.rows[0].count;
                },
                { timeout: 10000 },
              )
              .toBe(2);
          } finally {
            await blocker.query("COMMIT");
          }
          const results = await settled;
          expect(results.every((result) => result.status === "fulfilled")).toBe(
            true,
          );
          const values = results.map((result) =>
            result.status === "fulfilled" ? result.value : null,
          );
          expect(values).toEqual(
            expect.arrayContaining([
              { ok: true, alreadyDeleted: false },
              { ok: true, alreadyDeleted: true },
            ]),
          );
          expect(
            await owner.auditLog.count({
              where: { action: "homework_delete" },
            }),
          ).toBe(1);
          const tombstone = await owner.homework.findUniqueOrThrow({
            where: { id: homeworkId },
          });
          expect(tombstone.deletedAt).toBeInstanceOf(Date);
          expect([firstUserId, adminUserId]).toContain(tombstone.deletedById);
        });
      } finally {
        await blocker.end();
      }
    });

    it("preserves account-deletion SetNull and catalog cascade operations", async ({
      isolatedDatabase: { owner },
      rlsRuntime,
      rlsActors: { firstUserId },
      rlsSections: { sectionId },
      rlsHomework: { homeworkId },
    }) => {
      await owner.homework.update({
        where: { id: homeworkId },
        data: {
          updatedById: firstUserId,
          deletedById: firstUserId,
          deletedAt: new Date(),
        },
      });
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
      expect(
        await owner.homework.findUnique({
          where: { id: homeworkId },
          select: { createdById: true, updatedById: true, deletedById: true },
        }),
      ).toEqual({ createdById: null, updatedById: null, deletedById: null });
      await owner.section.delete({ where: { id: sectionId } });
      expect(await owner.homework.count()).toBe(0);
    });
  },
);
