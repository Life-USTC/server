import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createUploadSession,
  listUploads,
} from "@/features/uploads/server/upload-service";
import { Prisma } from "@/generated/prisma/client";
import { prisma, withUserDbContext } from "@/lib/db/prisma";

const rlsTestUserIds = ["rls-test-user-a", "rls-test-user-b"] as const;

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "upload PostgreSQL row security",
  () => {
    let firstUserId = "";
    let secondUserId = "";

    async function clearUploads(userId: string) {
      await withUserDbContext(userId, async (tx) => {
        await tx.uploadPending.deleteMany({ where: { userId } });
        await tx.upload.deleteMany({ where: { userId } });
      });
    }

    beforeAll(async () => {
      const users = await prisma.user.findMany({
        where: { id: { in: [...rlsTestUserIds] } },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      if (users.length !== 2) throw new Error("Expected two RLS test users");
      firstUserId = users[0].id;
      secondUserId = users[1].id;
    });

    beforeEach(async () => {
      await Promise.all([
        clearUploads(firstUserId),
        clearUploads(secondUserId),
      ]);
    });

    afterAll(async () => {
      for (const userId of [firstUserId, secondUserId]) {
        if (userId) await clearUploads(userId);
      }
      await prisma.$disconnect();
    });

    it("enables and forces one owner policy on both upload tables", async () => {
      const tables = await prisma.$queryRaw<
        {
          policyCount: bigint;
          rlsEnabled: boolean;
          rlsForced: boolean;
          tableName: string;
        }[]
      >(Prisma.sql`
        SELECT
          pg_class.relname AS "tableName",
          pg_class.relrowsecurity AS "rlsEnabled",
          pg_class.relforcerowsecurity AS "rlsForced",
          count(pg_policies.policyname) AS "policyCount"
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        LEFT JOIN pg_policies
          ON pg_policies.schemaname = pg_namespace.nspname
          AND pg_policies.tablename = pg_class.relname
          AND pg_policies.policyname = pg_class.relname || '_owner_isolation'
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname IN ('Upload', 'UploadPending')
        GROUP BY pg_class.relname, pg_class.relrowsecurity,
          pg_class.relforcerowsecurity
        ORDER BY pg_class.relname
      `);

      expect(tables).toEqual([
        {
          policyCount: 1n,
          rlsEnabled: true,
          rlsForced: true,
          tableName: "Upload",
        },
        {
          policyCount: 1n,
          rlsEnabled: true,
          rlsForced: true,
          tableName: "UploadPending",
        },
      ]);
    });

    it("defaults to no rows or writes without an owner context", async () => {
      const created = await withUserDbContext(firstUserId, async (tx) => {
        const upload = await tx.upload.create({
          data: {
            filename: "rls-default-deny.txt",
            key: `uploads/${firstUserId}/rls-default-deny.txt`,
            size: 1,
            userId: firstUserId,
          },
          select: { id: true },
        });
        const pending = await tx.uploadPending.create({
          data: {
            expiresAt: new Date("2099-01-01T00:00:00.000Z"),
            filename: "rls-default-deny-pending.txt",
            key: `uploads/${firstUserId}/rls-default-deny-pending.txt`,
            size: 1,
            userId: firstUserId,
          },
          select: { id: true },
        });
        return { pending, upload };
      });

      await expect(
        prisma.upload.findMany({ where: { id: created.upload.id } }),
      ).resolves.toEqual([]);
      await expect(
        prisma.uploadPending.findMany({ where: { id: created.pending.id } }),
      ).resolves.toEqual([]);
      await expect(
        prisma.upload.updateMany({
          where: { id: created.upload.id },
          data: { filename: "hidden-update.txt" },
        }),
      ).resolves.toEqual({ count: 0 });
      await expect(
        prisma.uploadPending.deleteMany({ where: { id: created.pending.id } }),
      ).resolves.toEqual({ count: 0 });
      await expect(
        prisma.upload.create({
          data: {
            filename: "missing-context.txt",
            key: `uploads/${firstUserId}/missing-context.txt`,
            size: 1,
            userId: firstUserId,
          },
        }),
      ).rejects.toThrow();
    });

    it("isolates owners and rejects forged ownership", async () => {
      const [first, second] = await Promise.all(
        [firstUserId, secondUserId].map((userId) =>
          withUserDbContext(userId, async (tx) => ({
            pending: await tx.uploadPending.create({
              data: {
                expiresAt: new Date("2099-01-01T00:00:00.000Z"),
                filename: `${userId}-pending.txt`,
                key: `uploads/${userId}/rls-owner-pending.txt`,
                size: 2,
                userId,
              },
              select: { id: true },
            }),
            upload: await tx.upload.create({
              data: {
                filename: `${userId}.txt`,
                key: `uploads/${userId}/rls-owner.txt`,
                size: 3,
                userId,
              },
              select: { id: true },
            }),
          })),
        ),
      );

      await expect(
        withUserDbContext(firstUserId, async (tx) => ({
          pendings: await tx.uploadPending.findMany({
            select: { id: true },
            orderBy: { id: "asc" },
          }),
          uploads: await tx.upload.findMany({
            select: { id: true },
            orderBy: { id: "asc" },
          }),
        })),
      ).resolves.toEqual({
        pendings: [first.pending],
        uploads: [first.upload],
      });

      await expect(
        withUserDbContext(secondUserId, () =>
          prisma.upload.create({
            data: {
              filename: "forged.txt",
              key: `uploads/${firstUserId}/rls-forged.txt`,
              size: 1,
              userId: firstUserId,
            },
          }),
        ),
      ).rejects.toThrow();
      await expect(
        withUserDbContext(secondUserId, (tx) =>
          tx.uploadPending.deleteMany({ where: { id: first.pending.id } }),
        ),
      ).resolves.toEqual({ count: 0 });
      await expect(
        withUserDbContext(firstUserId, (tx) =>
          tx.upload.update({
            where: { id: first.upload.id },
            data: { userId: secondUserId },
          }),
        ),
      ).rejects.toThrow();

      await expect(
        listUploads(secondUserId, { pageSize: 10, skip: 0 }),
      ).resolves.toMatchObject({
        total: 1,
        uploads: [{ id: second.upload.id }],
        usedBytes: 5,
      });
    });

    it("keeps serializable reservations and stale cleanup in owner context", async () => {
      const expiredAt = new Date("2020-01-01T00:00:00.000Z");
      const [firstExpired, secondExpired] = await Promise.all(
        [firstUserId, secondUserId].map((userId) =>
          withUserDbContext(userId, (tx) =>
            tx.uploadPending.create({
              data: {
                expiresAt: expiredAt,
                filename: `${userId}-expired.txt`,
                key: `uploads/${userId}/rls-expired.txt`,
                size: 2,
                userId,
              },
              select: { id: true },
            }),
          ),
        ),
      );

      const session = await createUploadSession({
        origin: "https://life.example",
        upload: {
          contentType: "text/plain",
          filename: "reserved.txt",
          size: 6,
        },
        userId: firstUserId,
      });
      expect(session).toMatchObject({ usedBytes: 0 });
      expect(session.key).toMatch(new RegExp(`^uploads/${firstUserId}/`));

      await expect(
        withUserDbContext(firstUserId, (tx) =>
          tx.uploadPending.findUnique({ where: { id: firstExpired.id } }),
        ),
      ).resolves.toBeNull();
      await expect(
        withUserDbContext(secondUserId, (tx) =>
          tx.uploadPending.findUnique({ where: { id: secondExpired.id } }),
        ),
      ).resolves.toMatchObject({ id: secondExpired.id });
      await expect(
        listUploads(firstUserId, { pageSize: 10, skip: 0 }),
      ).resolves.toMatchObject({ usedBytes: 6 });
    });

    it("exposes only narrow download and public-profile projections", async () => {
      const createdAt = new Date("2026-07-30T00:00:00.000Z");
      const upload = await withUserDbContext(firstUserId, (tx) =>
        tx.upload.create({
          data: {
            createdAt,
            filename: "rls-projection.txt",
            key: `uploads/${firstUserId}/rls-projection.txt`,
            size: 4,
            userId: firstUserId,
          },
          select: { id: true },
        }),
      );

      await expect(
        withUserDbContext(firstUserId, (tx) =>
          tx.$queryRaw(Prisma.sql`
            SELECT * FROM public.find_downloadable_upload(${upload.id})
          `),
        ),
      ).resolves.toEqual([
        {
          contentType: null,
          filename: "rls-projection.txt",
          key: `uploads/${firstUserId}/rls-projection.txt`,
          userId: firstUserId,
        },
      ]);
      await expect(
        withUserDbContext(secondUserId, (tx) =>
          tx.$queryRaw(Prisma.sql`
            SELECT * FROM public.find_downloadable_upload(${upload.id})
          `),
        ),
      ).resolves.toEqual([]);

      await expect(
        prisma.$queryRaw(Prisma.sql`
          SELECT *
          FROM public.get_public_profile_upload_stats(
            ${firstUserId},
            ${new Date("2026-01-01T00:00:00.000Z")}
          )
        `),
      ).resolves.toEqual([{ createdAt, totalUploads: 1n }]);
    });
  },
);
