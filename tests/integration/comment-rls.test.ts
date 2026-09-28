import { describe, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { rlsTest as it } from "../shared/rls-fixture";

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "Comment PostgreSQL row security",
  () => {
    it("enables forced RLS with collaborative read and moderation policies", async ({
      rlsRuntime,
    }) => {
      await rlsRuntime.run(async () => {
        const [table] = await prisma.$queryRaw<
          { rlsEnabled: boolean; rlsForced: boolean }[]
        >(Prisma.sql`
        SELECT relrowsecurity AS "rlsEnabled", relforcerowsecurity AS "rlsForced"
        FROM pg_class JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public' AND pg_class.relname = 'Comment'
      `);
        const policies = await prisma.$queryRaw<
          { policyName: string; command: string }[]
        >(Prisma.sql`
        SELECT policyname AS "policyName", cmd AS command FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'Comment' ORDER BY policyname
      `);
        expect(table).toEqual({ rlsEnabled: true, rlsForced: true });
        expect(policies).toEqual([
          { policyName: "Comment_admin_moderator", command: "UPDATE" },
          { policyName: "Comment_admin_reader", command: "SELECT" },
          { policyName: "Comment_authenticated_reader", command: "SELECT" },
          { policyName: "Comment_hidden_count_reader", command: "SELECT" },
          { policyName: "Comment_owner_isolation", command: "ALL" },
          { policyName: "Comment_public_reader", command: "SELECT" },
          { policyName: "Comment_reply_parent_lock", command: "UPDATE" },
        ]);
      });
    });
    it("defaults direct reads to public active comments without user context", async ({
      rlsRuntime,
      rlsActors: { firstUserId },
      rlsComments: fixtureIds,
    }) => {
      await rlsRuntime.run(async () => {
        await expect(
          withUserDbContext(firstUserId, (tx) =>
            tx.comment.findUnique({
              where: { id: fixtureIds.public },
              select: { id: true, userId: true },
            }),
          ),
        ).resolves.toEqual({ id: fixtureIds.public, userId: firstUserId });
        const rows = await prisma.comment.findMany({
          where: { id: { in: Object.values(fixtureIds) } },
          select: { id: true },
          orderBy: { id: "asc" },
        });
        expect(rows).toEqual([{ id: fixtureIds.public }]);
      });
    });
    it("isolates authenticated reads across viewers", async ({
      rlsRuntime,
      rlsActors: { firstUserId, secondUserId },
      rlsComments: fixtureIds,
    }) => {
      await rlsRuntime.run(async () => {
        const [firstRows, secondRows] = await Promise.all([
          withUserDbContext(firstUserId, (tx) =>
            tx.comment.findMany({
              where: { id: { in: Object.values(fixtureIds) } },
              select: { id: true, status: true, visibility: true },
              orderBy: { id: "asc" },
            }),
          ),
          withUserDbContext(secondUserId, (tx) =>
            tx.comment.findMany({
              where: { id: { in: Object.values(fixtureIds) } },
              select: { id: true, status: true, visibility: true },
              orderBy: { id: "asc" },
            }),
          ),
        ]);
        expect(firstRows).toEqual([
          { id: fixtureIds.deleted, status: "deleted", visibility: "public" },
          {
            id: fixtureIds.loggedIn,
            status: "active",
            visibility: "logged_in_only",
          },
          { id: fixtureIds.public, status: "active", visibility: "public" },
          {
            id: fixtureIds.softbanned,
            status: "softbanned",
            visibility: "public",
          },
        ]);
        expect(secondRows).toEqual([
          {
            id: fixtureIds.loggedIn,
            status: "active",
            visibility: "logged_in_only",
          },
          { id: fixtureIds.public, status: "active", visibility: "public" },
        ]);
      });
    });
    it("keeps public read regression for anonymous viewers", async ({
      rlsRuntime,
      rlsComments: fixtureIds,
    }) => {
      await rlsRuntime.run(async () => {
        await expect(
          prisma.comment.findUnique({
            where: { id: fixtureIds.public },
            select: { id: true, visibility: true, status: true },
          }),
        ).resolves.toEqual({
          id: fixtureIds.public,
          status: "active",
          visibility: "public",
        });
        await expect(
          prisma.comment.findUnique({
            where: { id: fixtureIds.loggedIn },
            select: { id: true },
          }),
        ).resolves.toBeNull();
      });
    });
    it("allows admins to read and moderate comments they do not own", async ({
      rlsRuntime,
      rlsActors: { firstUserId, secondUserId, adminUserId },
      rlsSections: { sectionId },
    }) => {
      await rlsRuntime.run(async () => {
        const moderatedId = `rls-test-comment-admin-moderation-${Date.now()}`;
        await withUserDbContext(firstUserId, (tx) =>
          tx.comment.create({
            data: {
              id: moderatedId,
              body: "RLS admin moderation fixture",
              sectionId,
              status: "active",
              userId: firstUserId,
              visibility: "public",
            },
          }),
        );
        try {
          await withUserDbContext(adminUserId, (tx) =>
            tx.comment.update({
              where: { id: moderatedId },
              data: {
                status: "softbanned",
                moderatedAt: new Date(),
                moderatedById: adminUserId,
              },
            }),
          );
          await expect(
            withUserDbContext(secondUserId, (tx) =>
              tx.comment.findUnique({
                where: { id: moderatedId },
                select: { id: true },
              }),
            ),
          ).resolves.toBeNull();
          await expect(
            withUserDbContext(adminUserId, (tx) =>
              tx.comment.findUnique({
                where: { id: moderatedId },
                select: { id: true, status: true },
              }),
            ),
          ).resolves.toEqual({ id: moderatedId, status: "softbanned" });
        } finally {
          await withUserDbContext(adminUserId, (tx) =>
            tx.comment.updateMany({
              where: { id: moderatedId },
              data: { status: "deleted", deletedAt: new Date() },
            }),
          );
        }
      });
    });
    it("rejects forged ownership on writes", async ({
      rlsRuntime,
      rlsActors: { firstUserId, secondUserId },
      rlsSections: { sectionId },
    }) => {
      await rlsRuntime.run(async () => {
        await expect(
          withUserDbContext(secondUserId, (tx) =>
            tx.comment.create({
              data: {
                body: "forged owner",
                sectionId,
                userId: firstUserId,
                visibility: "public",
              },
            }),
          ),
        ).rejects.toThrow();
      });
    });
  },
);
