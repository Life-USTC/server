/** Paginated comment thread root + descendant read model. */
import { Prisma } from "@/generated/prisma/client";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/db/prisma";
import { getUserRlsTransactionClient } from "@/lib/db/rls-context";
import { runCloudflareTraceSpan } from "@/lib/ports/runtime";
import {
  type CommentDbClient,
  withCommentDbContext,
} from "./comment-db-context";
import {
  observeCommentViewerContext,
  withCommentReadMetadata,
} from "./comment-read-metadata";
import {
  type CommentDescendantWindowRow,
  commentThreadInclude,
  directlyVisibleCommentSql,
} from "./comment-read-shared";
import {
  COMMENT_REPLY_MAX_ANCESTRY_DEPTH,
  COMMENT_REPLY_PREVIEW_SIZE,
  encodeCommentReplyCursor,
} from "./comment-reply-pagination";
import { buildCommentNodes, type RawComment } from "./comment-serialization";
import {
  type CommentStageCounter,
  countCommentStageQuery,
  countCommentStageTransaction,
  createCommentStageCounter,
  observeCommentStage,
} from "./comment-stage-analytics";
import type { ResolvedCommentTarget } from "./comment-utils";

type CommentRootPageRow = {
  id: string | null;
  total: bigint;
};

async function countAnonymousHiddenRoots(
  whereTarget: Record<string, number | string>,
  counter?: CommentStageCounter,
): Promise<number> {
  const sectionId =
    typeof whereTarget.sectionId === "number" ? whereTarget.sectionId : null;
  const courseId =
    typeof whereTarget.courseId === "number" ? whereTarget.courseId : null;
  const teacherId =
    typeof whereTarget.teacherId === "number" ? whereTarget.teacherId : null;
  const homeworkId =
    typeof whereTarget.homeworkId === "string" ? whereTarget.homeworkId : null;
  const sectionTeacherId =
    typeof whereTarget.sectionTeacherId === "number"
      ? whereTarget.sectionTeacherId
      : null;

  countCommentStageQuery(counter);
  const [row] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT public.comment_hidden_root_count(
      ${sectionId},
      ${courseId},
      ${teacherId},
      ${homeworkId},
      ${sectionTeacherId}
    ) AS count
  `;
  return Number(row?.count ?? 0);
}

function commentTargetPredicate(
  alias: "child" | "parent" | "root",
  whereTarget: Record<string, number | string>,
) {
  const column = (name: string) => Prisma.raw(`${alias}."${name}"`);
  if (typeof whereTarget.sectionId === "number") {
    return Prisma.sql`${column("sectionId")} = ${whereTarget.sectionId}`;
  }
  if (typeof whereTarget.courseId === "number") {
    return Prisma.sql`${column("courseId")} = ${whereTarget.courseId}`;
  }
  if (typeof whereTarget.teacherId === "number") {
    return Prisma.sql`${column("teacherId")} = ${whereTarget.teacherId}`;
  }
  if (typeof whereTarget.homeworkId === "string") {
    return Prisma.sql`${column("homeworkId")} = ${whereTarget.homeworkId}`;
  }
  if (typeof whereTarget.sectionTeacherId === "number") {
    return Prisma.sql`${column("sectionTeacherId")} = ${whereTarget.sectionTeacherId}`;
  }
  return Prisma.sql`FALSE`;
}

async function loadPaginatedCommentRoots(
  client: Pick<Prisma.TransactionClient, "$queryRaw">,
  target: ResolvedCommentTarget,
  viewer: ViewerContext,
  pagination: { pageSize: number; skip: number },
  counter?: CommentStageCounter,
) {
  const rootVisible = directlyVisibleCommentSql("root", viewer);
  const childVisible = directlyVisibleCommentSql("child", viewer);
  const query = Prisma.sql`
    WITH eligible_roots AS MATERIALIZED (
      -- A root hidden from this viewer cannot expose its own timestamp. Use
      -- the earliest directly visible descendant as its viewer-safe ordering
      -- key so SQL paging and the redacted root placeholder sort identically.
      SELECT
        root.id,
        CASE
          WHEN ${rootVisible} THEN root."createdAt"
          ELSE visible_child."createdAt"
        END AS "orderCreatedAt"
      FROM "Comment" AS root
      LEFT JOIN LATERAL (
        SELECT child.id, child."createdAt"
        FROM "Comment" AS child
        WHERE ${commentTargetPredicate("child", target.whereTarget)}
          AND ${childVisible}
          AND NOT COALESCE((${rootVisible}), FALSE)
          AND child."rootId" = root.id
        ORDER BY child."createdAt" ASC, child.id ASC
        LIMIT 1
      ) AS visible_child ON TRUE
      WHERE ${commentTargetPredicate("root", target.whereTarget)}
        AND root."parentId" IS NULL
        AND (
          ${rootVisible}
          OR visible_child.id IS NOT NULL
        )
    ),
    paged_roots AS (
      SELECT id, "orderCreatedAt"
      FROM eligible_roots
      ORDER BY "orderCreatedAt" ASC, id ASC
      OFFSET ${pagination.skip}
      LIMIT ${pagination.pageSize}
    ),
    root_total AS (
      SELECT count(*)::bigint AS total
      FROM eligible_roots
    )
    SELECT page.id, total.total
    FROM root_total AS total
    LEFT JOIN paged_roots AS page ON TRUE
  `;
  countCommentStageQuery(counter);
  const rows = await client.$queryRaw<CommentRootPageRow[]>(query);
  return {
    rootIds: rows.flatMap((row) => (row.id ? [row.id] : [])),
    total: Number(rows[0]?.total ?? 0),
  };
}

async function loadBoundedCommentDescendants(
  client: CommentDbClient,
  target: ResolvedCommentTarget,
  rootIds: string[],
  viewer: ViewerContext,
  counter?: CommentStageCounter,
) {
  if (rootIds.length === 0) {
    return {
      comments: [] as RawComment[],
      repliesNextCursorByRootId: new Map<string, string | null>(),
    };
  }

  const query = Prisma.sql`
    WITH RECURSIVE ranked_descendants AS (
      SELECT
        candidates."id",
        candidates."parentId",
        candidates."rootId",
        candidates."createdAt",
        ROW_NUMBER() OVER (
          PARTITION BY candidates."rootId"
          ORDER BY candidates."createdAt" ASC, candidates."id" ASC
        ) AS "rowNumber"
      FROM (VALUES ${Prisma.join(rootIds.map((rootId) => Prisma.sql`(${rootId})`))})
        AS requested("rootId")
      CROSS JOIN LATERAL (
        SELECT
          child."id",
          child."parentId",
          child."rootId",
          child."createdAt"
        FROM "Comment" AS child
        WHERE ${commentTargetPredicate("child", target.whereTarget)}
          AND ${directlyVisibleCommentSql("child", viewer)}
          AND child."rootId" = requested."rootId"
          AND child."id" <> requested."rootId"
        ORDER BY child."createdAt" ASC, child."id" ASC
        LIMIT ${COMMENT_REPLY_PREVIEW_SIZE + 1}
      ) AS candidates
    )
    , preview_descendants AS (
      SELECT "id", "parentId", "rootId", "createdAt", "rowNumber"
      FROM ranked_descendants
      WHERE "rowNumber" <= ${COMMENT_REPLY_PREVIEW_SIZE}
    )
    , ancestry AS (
      SELECT "id", "parentId", "rootId", "createdAt", 0 AS "depth"
      FROM preview_descendants
      UNION ALL
      SELECT parent."id", parent."parentId", parent."rootId", parent."createdAt", ancestry."depth" + 1
      FROM "Comment" AS parent
      JOIN ancestry ON ancestry."parentId" = parent."id"
      WHERE ancestry."depth" < ${COMMENT_REPLY_MAX_ANCESTRY_DEPTH}
        AND ${commentTargetPredicate("parent", target.whereTarget)}
    )
    , bounded_rows AS (
      SELECT "id", "rootId", "createdAt", "rowNumber"
      FROM ranked_descendants
      WHERE "rowNumber" <= ${COMMENT_REPLY_PREVIEW_SIZE + 1}
      UNION
      SELECT ancestry."id", ancestry."rootId", ancestry."createdAt", NULL::bigint
      FROM ancestry
      WHERE ancestry."id" NOT IN (SELECT "id" FROM preview_descendants)
    )
    SELECT "id", "rootId", "createdAt", "rowNumber"
    FROM bounded_rows
    ORDER BY "rootId" ASC NULLS LAST, "rowNumber" ASC NULLS LAST, "createdAt" ASC, "id" ASC
  `;
  countCommentStageQuery(counter);
  const rows = await client.$queryRaw<CommentDescendantWindowRow[]>(query);
  const selectedRows = rows.filter(
    (row) =>
      row.rowNumber !== null &&
      Number(row.rowNumber) <= COMMENT_REPLY_PREVIEW_SIZE,
  );
  const selectedIds = [
    ...new Set([
      ...rootIds,
      ...selectedRows.map((row) => row.id),
      ...rows.filter((row) => row.rowNumber === null).map((row) => row.id),
    ]),
  ];
  if (selectedIds.length === 0) {
    return {
      comments: [] as RawComment[],
      repliesNextCursorByRootId: new Map<string, string | null>(),
    };
  }

  countCommentStageQuery(counter);
  const comments = await client.comment.findMany({
    where: { AND: [target.whereTarget, { id: { in: selectedIds } }] },
    include: commentThreadInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const repliesNextCursorByRootId = new Map<string, string | null>();
  for (const rootId of rootIds) {
    const rootRows = rows.filter(
      (row) => row.rootId === rootId && row.rowNumber !== null,
    );
    if (rootRows.length <= COMMENT_REPLY_PREVIEW_SIZE) {
      repliesNextCursorByRootId.set(rootId, null);
      continue;
    }
    const lastSelected = rootRows[COMMENT_REPLY_PREVIEW_SIZE - 1];
    repliesNextCursorByRootId.set(
      rootId,
      lastSelected
        ? encodeCommentReplyCursor({
            createdAt: lastSelected.createdAt.toISOString(),
            id: lastSelected.id,
            rootId,
          })
        : null,
    );
  }

  return { comments, repliesNextCursorByRootId };
}

export async function loadCommentThread(input: {
  pagination?: { pageSize: number; skip: number };
  target: ResolvedCommentTarget;
  viewer?: ViewerContext;
  viewerContextStageRecorded?: boolean;
  viewerUserId: string | null;
}) {
  if (input.target.empty) {
    const viewer =
      input.viewerContextStageRecorded && input.viewer
        ? input.viewer
        : await observeCommentViewerContext(input);
    return { comments: [], hiddenCount: 0, total: 0, viewer };
  }

  const viewer =
    input.viewerContextStageRecorded && input.viewer
      ? input.viewer
      : await runCloudflareTraceSpan(
          "viewer.context",
          { source: "comments" },
          () => observeCommentViewerContext(input),
        );
  const pagination = input.pagination ?? { pageSize: 20, skip: 0 };
  const rootCounter = createCommentStageCounter({
    dbContext: input.viewerUserId ? "rls" : "none",
    dbLabel: "app",
  });
  if (input.viewerUserId && !getUserRlsTransactionClient()) {
    countCommentStageTransaction(rootCounter);
  }
  const { comments, hiddenCount, repliesNextCursorByRootId, total } =
    await withCommentDbContext(input.viewerUserId, async (client) => {
      const rootPagePromise = runCloudflareTraceSpan(
        "comments.root",
        {
          pageSize: pagination.pageSize,
          skip: pagination.skip,
          targetType: Object.keys(input.target.whereTarget)[0],
        },
        () =>
          observeCommentStage({
            counter: rootCounter,
            details: (result) => ({
              rootCount: result?.rootIds.length,
            }),
            stage: "comments.root",
            work: () =>
              loadPaginatedCommentRoots(
                client,
                input.target,
                viewer,
                pagination,
                rootCounter,
              ),
          }),
      );
      const [rootPage, hiddenCount] = await Promise.all([
        rootPagePromise,
        viewer.isAuthenticated
          ? Promise.resolve(0)
          : countAnonymousHiddenRoots(input.target.whereTarget, rootCounter),
      ]);
      const descendantsCounter = createCommentStageCounter({
        dbContext: input.viewerUserId ? "rls" : "none",
        dbLabel: "app",
      });
      const descendantResult =
        rootPage.rootIds.length === 0
          ? {
              comments: [] as RawComment[],
              repliesNextCursorByRootId: new Map<string, string | null>(),
            }
          : await runCloudflareTraceSpan(
              "comments.descendants",
              {
                rootCount: rootPage.rootIds.length,
                targetType: Object.keys(input.target.whereTarget)[0],
              },
              () =>
                observeCommentStage({
                  counter: descendantsCounter,
                  details: (result) => ({
                    loadedCount: result?.comments.length,
                  }),
                  stage: "comments.descendants",
                  work: () =>
                    loadBoundedCommentDescendants(
                      client,
                      input.target,
                      rootPage.rootIds,
                      viewer,
                      descendantsCounter,
                    ),
                }),
            );

      return {
        comments: descendantResult.comments,
        hiddenCount,
        repliesNextCursorByRootId: descendantResult.repliesNextCursorByRootId,
        total: rootPage.total,
      };
    });

  const summariesCounter = createCommentStageCounter({
    dbContext: viewer.userId ? "rls" : "none",
    dbLabel: "app",
  });
  const commentsWithMetadata = await runCloudflareTraceSpan(
    "comments.summaries",
    { commentCount: comments.length },
    () =>
      observeCommentStage({
        counter: summariesCounter,
        details: () => ({ loadedCount: comments.length }),
        stage: "comments.summaries",
        work: () =>
          withCommentReadMetadata(comments, viewer.userId, summariesCounter),
      }),
  );
  const { roots } = buildCommentNodes(commentsWithMetadata, viewer, {
    repliesNextCursorByRootId,
  });
  return { comments: roots, hiddenCount, total, viewer };
}
