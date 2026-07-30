import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type CommentReactionType, Prisma } from "@/generated/prisma/client";
import { prisma, withUserDbContext } from "@/lib/db/prisma";

const rlsTestUserIds = ["rls-test-user-a", "rls-test-user-b"] as const;

type ReactionSummaryRow = {
  commentId: string;
  type: CommentReactionType;
  count: bigint;
  viewerHasReacted: boolean;
};

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "CommentReaction PostgreSQL row security",
  () => {
    let firstUserId = "";
    let secondUserId = "";
    let adminUserId = "";
    let commentId = "";

    async function clearTestReactions(userId: string) {
      await withUserDbContext(userId, (tx) =>
        tx.commentReaction.deleteMany({
          where: { commentId, userId },
        }),
      );
    }

    async function loadReactionSummary(
      type: CommentReactionType,
      viewerUserId: string | null,
      targetCommentId = commentId,
    ) {
      const query = (tx: Pick<Prisma.TransactionClient, "$queryRaw">) =>
        tx.$queryRaw<ReactionSummaryRow[]>(Prisma.sql`
          SELECT
            "commentId",
            "type",
            "count",
            "viewerHasReacted"
          FROM public.comment_reaction_summaries(
            ARRAY[${targetCommentId}]::text[]
          )
          WHERE "type" = ${type}::public."CommentReactionType"
        `);

      const rows = viewerUserId
        ? await withUserDbContext(viewerUserId, query)
        : await query(prisma);
      return rows[0] ?? null;
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

      const admin = await prisma.user.findFirst({
        where: { isAdmin: true },
        select: { id: true },
      });
      if (!admin) throw new Error("Expected a seeded admin user");
      adminUserId = admin.id;

      const seededReaction = await withUserDbContext(admin.id, (tx) =>
        tx.commentReaction.findFirst({
          orderBy: { id: "asc" },
          select: { commentId: true },
        }),
      );
      if (!seededReaction)
        throw new Error("Expected a seeded comment reaction");
      commentId = seededReaction.commentId;
    });

    beforeEach(async () => {
      await Promise.all([
        clearTestReactions(firstUserId),
        clearTestReactions(secondUserId),
      ]);
    });

    afterAll(async () => {
      if (commentId) {
        await Promise.all([
          clearTestReactions(firstUserId),
          clearTestReactions(secondUserId),
        ]);
      }
      await prisma.$disconnect();
    });

    it("keeps forced owner isolation and a function-scoped summary policy", async () => {
      const [table] = await prisma.$queryRaw<
        { owner: string; rlsEnabled: boolean; rlsForced: boolean }[]
      >(Prisma.sql`
        SELECT
          pg_get_userbyid(pg_class.relowner) AS owner,
          pg_class.relrowsecurity AS "rlsEnabled",
          pg_class.relforcerowsecurity AS "rlsForced"
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_class.relname = 'CommentReaction'
      `);
      const policies = await prisma.$queryRaw<
        {
          policyName: string;
          command: string;
          roles: string[];
          usingExpression: string;
          checkExpression: string | null;
        }[]
      >(Prisma.sql`
        SELECT
          policyname AS "policyName",
          cmd AS command,
          roles::text[] AS roles,
          qual AS "usingExpression",
          with_check AS "checkExpression"
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'CommentReaction'
        ORDER BY policyname
      `);
      const [summaryFunction] = await prisma.$queryRaw<
        {
          owner: string;
          securityDefiner: boolean;
          settings: string[] | null;
        }[]
      >(Prisma.sql`
        SELECT
          pg_get_userbyid(pg_proc.proowner) AS owner,
          pg_proc.prosecdef AS "securityDefiner",
          pg_proc.proconfig AS settings
        FROM pg_proc
        JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_proc.proname = 'comment_reaction_summaries'
          AND pg_get_function_identity_arguments(pg_proc.oid) = 'comment_ids text[]'
      `);

      expect(table).toMatchObject({ rlsEnabled: true, rlsForced: true });
      expect(policies).toEqual([
        {
          policyName: "CommentReaction_owner_isolation",
          command: "ALL",
          roles: ["public"],
          usingExpression: expect.stringContaining(
            "current_setting('app.user_id'::text, true)",
          ),
          checkExpression: expect.stringContaining(
            "current_setting('app.user_id'::text, true)",
          ),
        },
        {
          policyName: "CommentReaction_summary_reader",
          command: "SELECT",
          roles: [summaryFunction.owner],
          usingExpression: expect.stringContaining(
            "current_setting('app.comment_reaction_summary'::text, true)",
          ),
          checkExpression: null,
        },
      ]);
      expect(summaryFunction).toEqual({
        owner: "life_ustc_function_owner",
        securityDefiner: true,
        settings: expect.arrayContaining([
          'search_path=""',
          "app.comment_reaction_summary=on",
        ]),
      });
    });

    it("defaults direct reads and writes to no access without user context", async () => {
      const created = await withUserDbContext(firstUserId, (tx) =>
        tx.commentReaction.create({
          data: { commentId, type: "confused", userId: firstUserId },
          select: { id: true },
        }),
      );

      await expect(
        prisma.commentReaction.findMany({ where: { id: created.id } }),
      ).resolves.toEqual([]);
      await expect(
        prisma.commentReaction.create({
          data: { commentId, type: "laugh", userId: firstUserId },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.commentReaction.updateMany({
          where: { id: created.id },
          data: { type: "heart" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.commentReaction.deleteMany({ where: { id: created.id } }),
      ).resolves.toEqual({ count: 0 });
    });

    it("isolates owners and rejects forged ownership", async () => {
      const [first, second] = await Promise.all([
        withUserDbContext(firstUserId, (tx) =>
          tx.commentReaction.create({
            data: { commentId, type: "laugh", userId: firstUserId },
            select: { id: true, userId: true },
          }),
        ),
        withUserDbContext(secondUserId, (tx) =>
          tx.commentReaction.create({
            data: { commentId, type: "hooray", userId: secondUserId },
            select: { id: true, userId: true },
          }),
        ),
      ]);

      const [firstRows, secondRows, adminRows] = await Promise.all([
        withUserDbContext(firstUserId, (tx) =>
          tx.commentReaction.findMany({
            where: { id: { in: [first.id, second.id] } },
            select: { id: true, userId: true },
          }),
        ),
        withUserDbContext(secondUserId, (tx) =>
          tx.commentReaction.findMany({
            where: { id: { in: [first.id, second.id] } },
            select: { id: true, userId: true },
          }),
        ),
        withUserDbContext(adminUserId, (tx) =>
          tx.commentReaction.findMany({
            where: { id: { in: [first.id, second.id] } },
            select: { id: true, userId: true },
          }),
        ),
      ]);

      expect(firstRows).toEqual([first]);
      expect(secondRows).toEqual([second]);
      expect(adminRows).toEqual([]);
      await expect(
        withUserDbContext(secondUserId, (tx) =>
          tx.commentReaction.updateMany({
            where: { id: first.id },
            data: { type: "eyes" },
          }),
        ),
      ).rejects.toThrow();
      await expect(
        withUserDbContext(secondUserId, (tx) =>
          tx.commentReaction.deleteMany({ where: { id: first.id } }),
        ),
      ).resolves.toEqual({ count: 0 });
      await expect(
        withUserDbContext(firstUserId, (tx) =>
          tx.commentReaction.update({
            where: { id: first.id },
            data: { userId: secondUserId },
          }),
        ),
      ).rejects.toThrow();
      await expect(
        withUserDbContext(secondUserId, (tx) =>
          tx.commentReaction.create({
            data: { commentId, type: "rocket", userId: firstUserId },
          }),
        ),
      ).rejects.toThrow();
    });

    it("exposes only aggregate counts while preserving viewer state", async () => {
      const baseline = await loadReactionSummary("eyes", null);
      await Promise.all([
        withUserDbContext(firstUserId, (tx) =>
          tx.commentReaction.create({
            data: { commentId, type: "eyes", userId: firstUserId },
          }),
        ),
        withUserDbContext(secondUserId, (tx) =>
          tx.commentReaction.create({
            data: { commentId, type: "eyes", userId: secondUserId },
          }),
        ),
      ]);

      const [anonymous, firstViewer, adminViewer] = await Promise.all([
        loadReactionSummary("eyes", null),
        loadReactionSummary("eyes", firstUserId),
        loadReactionSummary("eyes", adminUserId),
      ]);
      const expectedCount = (baseline?.count ?? 0n) + 2n;

      expect(anonymous).toEqual({
        commentId,
        count: expectedCount,
        type: "eyes",
        viewerHasReacted: false,
      });
      expect(firstViewer).toEqual({
        ...anonymous,
        viewerHasReacted: true,
      });
      expect(adminViewer).toEqual(anonymous);
      expect(Object.keys(anonymous ?? {}).sort()).toEqual(
        ["commentId", "count", "type", "viewerHasReacted"].sort(),
      );
    });

    it("does not disclose reaction counts for comments hidden from the viewer", async () => {
      const loggedInCommentId = "rls-test-comment-logged-in";
      const softbannedCommentId = "rls-test-comment-softbanned";
      const deletedCommentId = "rls-test-comment-deleted";

      await expect(
        loadReactionSummary("heart", null, loggedInCommentId),
      ).resolves.toBeNull();
      await expect(
        loadReactionSummary("heart", firstUserId, loggedInCommentId),
      ).resolves.toMatchObject({ commentId: loggedInCommentId, count: 1n });

      await expect(
        loadReactionSummary("heart", null, softbannedCommentId),
      ).resolves.toBeNull();
      await expect(
        loadReactionSummary("heart", secondUserId, softbannedCommentId),
      ).resolves.toBeNull();
      await expect(
        loadReactionSummary("heart", firstUserId, softbannedCommentId),
      ).resolves.toMatchObject({ commentId: softbannedCommentId, count: 1n });
      await expect(
        loadReactionSummary("heart", adminUserId, softbannedCommentId),
      ).resolves.toMatchObject({ commentId: softbannedCommentId, count: 1n });

      await expect(
        loadReactionSummary("heart", adminUserId, deletedCommentId),
      ).resolves.toBeNull();
    });
  },
);
