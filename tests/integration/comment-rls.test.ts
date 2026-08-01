import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { prisma, withUserDbContext } from "@/lib/db/prisma";

const rlsTestUserIds = ["rls-test-user-a", "rls-test-user-b"] as const;
const fixtureIds = {
  deleted: "rls-test-comment-deleted",
  loggedIn: "rls-test-comment-logged-in",
  public: "rls-test-comment-public",
  softbanned: "rls-test-comment-softbanned",
} as const;

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "Comment PostgreSQL row security",
  () => {
    let firstUserId = "";
    let secondUserId = "";
    let adminUserId = "";
    let sectionId = 0;

    beforeAll(async () => {
      const users = await prisma.user.findMany({
        where: { id: { in: [...rlsTestUserIds] } },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      if (users.length !== 2) throw new Error("Expected two RLS test users");
      [firstUserId, secondUserId] = [users[0].id, users[1].id];
      const admin = await prisma.user.findFirst({
        where: { isAdmin: true },
        select: { id: true },
      });
      if (!admin) throw new Error("Expected a seeded admin user");
      adminUserId = admin.id;
      const section = await prisma.section.findFirst({
        orderBy: { id: "asc" },
        select: { id: true },
      });
      if (!section) throw new Error("Expected a seeded section");
      sectionId = section.id;
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    it("enables forced RLS with collaborative read and moderation policies", async () => {
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
        { policyName: "Comment_owner_isolation", command: "ALL" },
        { policyName: "Comment_public_reader", command: "SELECT" },
      ]);
    });

    it("defaults direct reads to public active comments without user context", async () => {
      const rows = await prisma.comment.findMany({
        where: { id: { in: Object.values(fixtureIds) } },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      expect(rows).toEqual([{ id: fixtureIds.public }]);
    });

    it("isolates authenticated reads across viewers", async () => {
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

    it("keeps public read regression for anonymous viewers", async () => {
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

    it("allows admins to read and moderate comments they do not own", async () => {
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

    it("rejects forged ownership on writes", async () => {
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
  },
);
